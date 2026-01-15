"use client"
import { supabase } from '@/lib/supabase'
import {useState, useEffect, useRef, useCallback} from 'react'
import toast from 'react-hot-toast'

type Message = {
  id: string
  sender: string
  message: string
  created_at: string
}

// 根据当前身份获取对方身份
function getReceiverName(sender: string): string | null {
  if (sender === 'Ann') return 'Sid'
  if (sender === 'Sid') return 'Ann'
  return null
}

export default function Home() {
  const [message, setMessage] = useState('')
  const [sender, setSender] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [sentMessages, setSentMessages] = useState<Message[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)

  const fetchMessages = useCallback(async () => {
    if (!sender) {
      setMessages([])
      return
    } 
    const receiver = getReceiverName(sender)
    if (!receiver) {
      setMessages([])
      return
    }
    const { data, error } = await supabase
      .from('message')
      .select('*')
      .eq('sender', receiver)
      .order('created_at', { ascending: false })
      .limit(5)
    if (error) {
      console.error('查询消息失败:', error)
      toast.error('加载消息失败')
      return
    }
    setMessages(data || [])
  }, [sender])


  const fetchSentMessages = useCallback(async() => {
      if (!sender) {
        setSentMessages([])
        return
      }
      const { data, error } = await supabase
        .from('message')
        .select('*')
        .eq('sender', sender)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) {
        console.error('查询消息失败:', error)
        toast.error('加载消息失败')
        return
      }
      setSentMessages(data || [])
  },[sender])


  useEffect(() => {
    const savedSender = localStorage.getItem('my_name')
    if (savedSender === 'Ann' || savedSender === 'Sid') {
      setSender(savedSender)
    }

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

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
        handleNewMessage(payload.new as Message)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (sender) {
      fetchMessages()
      fetchSentMessages()
    } else {
      setMessages([])
      setSentMessages([])
    }
  }, [sender, fetchMessages, fetchSentMessages])

  function handleNewMessage(newMessage: Message) {
    if (!sender) return

    const receiver = getReceiverName(sender)
    
    if (newMessage.sender === sender) {
      fetchSentMessages()
    }
    
    if (receiver && newMessage.sender === receiver) {
      showNotification(newMessage)
      playNotificationSound()
      toast.success(`收到来自 ${newMessage.sender} 的提醒！`)
      fetchMessages()
    }
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
      console.log('音频播放失败:', error)
    }
  }

  function formatTime(timestamp: string): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 60) {
      return `${diffMins} mins ago`
    }

    return date.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function handleSenderChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newSender = e.target.value
    setSender(newSender)
    localStorage.setItem('my_name', newSender)
  }

  const friendName = sender === 'Ann' ? 'Sid' : sender === 'Sid' ? 'Ann' : ''

  async function handleclick() {
    if(!sender || !message) {
      toast.error('Please select a sender and enter a message') 
      return
    }
    
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
    fetchSentMessages()
    setMessage('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Click to remind your friend to drink water
        </h1>
        <div className="flex flex-col gap-6">
        <select
          value={sender}
          onChange={handleSenderChange}
          className="w-full bg-transparent text-slate-700 text-sm border border-slate-200 rounded-md px-3 py-2 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-300 shadow-sm focus:shadow"
        >
          <option value="">Please choose who you are</option>
          <option value="Ann">Ann</option>
          <option value="Sid">Sid</option>
        </select>
        {friendName && (
          <p className="text-sm text-gray-500 -mt-4">
            You want to remind：{friendName}
          </p>
        )}
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
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Received Messages</h2>
          
          {messages.length === 0 ? (
            <p className="text-gray-500 text-sm">暂无消息</p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className="bg-white border border-slate-200 rounded-md p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{msg.sender}</span>
                      <span className="text-sm text-gray-500">reminds you</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  <p className="text-gray-700">{msg.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="w-full mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Messages You Sent</h2>
          
          {sentMessages.length === 0 ? (
            <p className="text-gray-500 text-sm">暂无消息</p>
          ) : (
            <div className="space-y-3">
              {sentMessages.map((msg) => (
                <div 
                  key={msg.id}
                  className="bg-white border border-slate-200 rounded-md p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">You</span>
                      <span className="text-sm text-gray-500">remind {friendName}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  <p className="text-gray-700">{msg.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}