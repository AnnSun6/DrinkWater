"use client"
import { supabase } from '@/lib/supabase'
import {useState, useEffect, useRef, useCallback} from 'react'
import toast from 'react-hot-toast'

type Message = {
  id: string
  sender: string
  message: string
  created_at: string
  is_read?: boolean
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
  const [todayTotalMl, setTodayTotalMl] = useState(0)
  const [cupSizeMl, setCupSizeMl] = useState(250)
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
    if (error) return
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
      if (error) return
      setSentMessages(data || [])
  },[sender])


  useEffect(() => {
    const savedSender = localStorage.getItem('my_name')
    if (savedSender === 'Ann' || savedSender === 'Sid') {
      setSender(savedSender)
    }

    // 加载今日总量
    const today = new Date().toISOString().split('T')[0] // "YYYY-MM-DD"
    const savedToday = localStorage.getItem(`water_${today}`)
    if (savedToday) {
      setTodayTotalMl(parseInt(savedToday) || 0)
    }

    // 加载配置：一杯的毫升数
    const savedCupSize = localStorage.getItem('cup_size_ml')
    if (savedCupSize) {
      const cupSize = parseInt(savedCupSize)
      if (!isNaN(cupSize) && cupSize > 0) {
        setCupSizeMl(cupSize)
      }
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
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'message'
      }, (payload) => {
        handleMessageUpdate(payload.new as Message)
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

  function handleMessageUpdate(updatedMessage: Message) {
    if (!sender) return
    const receiver = getReceiverName(sender)

    if (updatedMessage.sender === sender) {
      setSentMessages(prev => prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg))
    } else if (receiver && updatedMessage.sender === receiver) {
      setMessages(prev => prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg))
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
    } catch (error) {}
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

  function handleDrink(amountMl: number) {
    if (!sender) {
      toast.error('Please select your identity first')
      return
    }
    const today = new Date().toISOString().split('T')[0] // "YYYY-MM-DD"
    const newTotal = todayTotalMl + amountMl
    setTodayTotalMl(newTotal)
    localStorage.setItem(`water_${today}`, newTotal.toString())
    toast.success(`Recorded ${amountMl}ml!`)
  }

  function handleCupSizeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newSize = parseInt(e.target.value) || 250
    if (newSize > 0 && newSize <= 1000) {
      setCupSizeMl(newSize)
      localStorage.setItem('cup_size_ml', newSize.toString())
    }
  }

  async function handleclick() {
    if(!sender || !message) {
      toast.error('Please select a sender and enter a message') 
      return
    }
    
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume().catch(() => {})
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

  async function handleMarkAsRead(messageId: string) {
    await supabase
      .from('message')
      .update({ is_read: true })
      .eq('id', messageId)
    
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === messageId ? { ...msg, is_read: true } : msg
      )
    )
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
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Water Intake</h2>
          
          {/* 显示今日总量 */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <p className="text-lg font-semibold text-blue-900">
              Today's Total: {todayTotalMl} ml
            </p>
          </div>
          
          {/* 配置和按钮 */}
          <div className="flex gap-2 items-center justify-center flex-wrap">
            {/* 配置区域：一杯的毫升数 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700 whitespace-nowrap">
                Cup Size (ml):
              </label>
              <input
                type="number"
                min="50"
                max="1000"
                value={cupSizeMl}
                onChange={handleCupSizeChange}
                className="w-24 bg-transparent text-slate-700 text-sm border border-slate-200 rounded-md px-3 py-2 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-300 shadow-sm focus:shadow"
              />
            </div>
            
            {/* 三个按钮：一口、半杯、一杯 */}
            <button
              onClick={() => handleDrink(50)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Sip (+50ml)
            </button>
            <button
              onClick={() => handleDrink(Math.floor(cupSizeMl / 2))}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Half Cup (+{Math.floor(cupSizeMl / 2)}ml)
            </button>
            <button
              onClick={() => handleDrink(cupSizeMl)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Full Cup (+{cupSizeMl}ml)
            </button>
          </div>
        </div>
        <div className="w-full mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Received Messages</h2>
          
          {messages.length === 0 ? (
            <p className="text-gray-500 text-sm">暂无消息</p>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className="bg-white border border-slate-200 rounded-md px-4 py-2 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-semibold text-gray-900">{msg.sender}:</span>
                      <p className="text-sm text-gray-700 truncate">{msg.message}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatTime(msg.created_at)}
                      </span>
                      {!msg.is_read ? (
                        <button
                          onClick={() => handleMarkAsRead(msg.id)}
                          className="bg-green-500 hover:bg-green-600 text-white text-xs font-medium py-1 px-2 rounded transition-colors whitespace-nowrap"
                        >
                          got it
                        </button>
                      ) : (
                        <span className="text-xs text-green-600 font-medium whitespace-nowrap">✓ read</span>
                      )}
                    </div>
                  </div>
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
            <div className="space-y-2">
              {sentMessages.map((msg) => (
                <div 
                  key={msg.id}
                  className="bg-white border border-slate-200 rounded-md px-4 py-2 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-semibold text-gray-900">You:</span>
                      <p className="text-sm text-gray-700 truncate">{msg.message}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatTime(msg.created_at)}
                      </span>
                      {msg.is_read ? (
                        <span className="text-xs text-green-600 font-medium whitespace-nowrap">✓ read</span>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">⏳ unread</span>
                      )}
                    </div>
                  </div>
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