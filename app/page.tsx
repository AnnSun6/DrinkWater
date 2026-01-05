"use client"
import { supabase } from '@/lib/supabase'
import {useState, useEffect, useRef} from 'react'
import toast from 'react-hot-toast'

export default function Home() {
  const [message, setMessage] = useState('')
  const [sender, setSender] = useState('')
  const [lastMessage, setLastMessage] = useState('')
  const audioContextRef = useRef<AudioContext | null>(null)

  async function fetchLastMessage() {
    const { data } = await supabase
      .from('message')
      .select('message')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      setLastMessage(data.message)
    }
  }

  useEffect(() => {
    fetchLastMessage()

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // 初始化 AudioContext（但保持 suspended 状态，等待用户交互）
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (AudioContextClass) {
      audioContextRef.current = new AudioContextClass()
    }

    const channel = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message'
      }, (payload) => {
        handleNewMessage(payload.new as { sender: string; message: string })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      // 清理 AudioContext
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [])

  function handleNewMessage(newMessage: { sender: string; message: string }) {
    setLastMessage(newMessage.message)
    showNotification(newMessage)
    playNotificationSound()
    toast.success(`收到来自 ${newMessage.sender} 的提醒！`)
  }

  function showNotification(message: { sender: string; message: string }) {
    if (Notification.permission !== 'granted') return

    const notification = new Notification('Notification from fanfan', {
      body: `${message.sender}: ${message.message}`,
      tag: 'water-reminder',
      icon: '/favicon.ico'
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }

  async function playNotificationSound() {
    if (!audioContextRef.current) return

    try {
      // 如果 AudioContext 处于 suspended 状态，尝试恢复
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }

      const oscillator = audioContextRef.current.createOscillator()
      const gainNode = audioContextRef.current.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)

      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.3)

      oscillator.start(audioContextRef.current.currentTime)
      oscillator.stop(audioContextRef.current.currentTime + 0.3)
    } catch (error) {
      // 静默失败，不影响其他功能
      console.log('音频播放失败:', error)
    }
  }

  async function handleclick() {
    if(!sender || !message) {
      toast.error('Please enter a sender and message') 
      return
    }
    
    // 在用户点击时解锁 AudioContext（浏览器要求用户交互）
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume()
      } catch (error) {
        console.log('AudioContext 解锁失败:', error)
      }
    }
    
      const { error } = await supabase
        .from('message')
        .insert([
          { 
            sender: sender,      
            message: message     
          }
        ])
    
    if(error) {
      toast.error('Error: ' + error.message)
      return
    }
    toast.success('Message sent successfully!')
    setSender('')
    setMessage('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Click to remind your friend to drink water
        </h1>
        <div className="flex flex-col gap-6">
        <input
          type="text"
          placeholder="Your name"
          value={sender}
          onChange={(e) => setSender(e.target.value)}
          className="w-full bg-transparent placeholder:text-slate-400 text-slate-700 text-sm border border-slate-200 rounded-md px-3 py-2 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-300 shadow-sm focus:shadow"
        />
        <input
          type="text"
          placeholder="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full bg-transparent placeholder:text-slate-400 text-slate-700 text-sm border border-slate-200 rounded-md px-3 py-2 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-300 shadow-sm focus:shadow"
        />
        <button 
          onClick={handleclick}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          Tap to remind your friend
        </button>
        <div className="w-full mt-8">
          <p className="text-4xl font-bold text-gray-900 mb-8">Your friend remind you to:</p>
          <input
            type="text"
            placeholder="Last message will appear here"
            value={lastMessage}
            readOnly
            className="w-full bg-gray-100 placeholder:text-slate-400 text-slate-700 text-sm border border-slate-200 rounded-md px-3 py-2"
          />
        </div>
        </div>
      </div>
    </div>
  );
}