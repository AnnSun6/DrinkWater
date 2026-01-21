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

type DrinkLog = {
  id: string
  user_name: string
  amount_ml: number
  created_at: string
}

type UserSettings = {
  id: string
  user_name: string
  cup_size_ml: number
  updated_at: string
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
  const [activeTab, setActiveTab] = useState<'reminder' | 'log'>('reminder')
  const [drinkLogs, setDrinkLogs] = useState<DrinkLog[]>([])
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

  const fetchTodayTotalMl = useCallback(async () => {
    if (!sender) {
      setTodayTotalMl(0)
      return
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.toISOString()
    
    const { data } = await supabase
      .from('drink_logs')
      .select('amount_ml')
      .eq('user_name', sender)
      .gte('created_at', todayStart)
    
    const total = data?.reduce((sum, log) => sum + log.amount_ml, 0) || 0
    setTodayTotalMl(total)
  }, [sender])

  const fetchUserSettings = useCallback(async () => {
    if (!sender) {
      setCupSizeMl(250)
      return
    }
    
    const { data } = await supabase
      .from('user_settings')
      .select('cup_size_ml')
      .eq('user_name', sender)
      .single()
    
    if (data?.cup_size_ml) {
      setCupSizeMl(data.cup_size_ml)
    }
  }, [sender])

  const fetchDrinkLogs = useCallback(async () => {
    if (!sender) {
      setDrinkLogs([])
      return
    }
    
    const { data } = await supabase
      .from('drink_logs')
      .select('*')
      .eq('user_name', sender)
      .order('created_at', { ascending: false })
      .limit(50)
    
    setDrinkLogs(data || [])
  }, [sender])


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
      fetchTodayTotalMl()
      fetchUserSettings()
      fetchDrinkLogs()
    } else {
      setMessages([])
      setSentMessages([])
      setTodayTotalMl(0)
      setCupSizeMl(250)
      setDrinkLogs([])
    }
  }, [sender, fetchMessages, fetchSentMessages, fetchTodayTotalMl, fetchUserSettings, fetchDrinkLogs])

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

  async function handleDrink(amountMl: number) {
    if (!sender) return
    
    await supabase
      .from('drink_logs')
      .insert([{ user_name: sender, amount_ml: amountMl }])
    
    await fetchTodayTotalMl()
    await fetchDrinkLogs()
    toast.success(`Recorded ${amountMl}ml!`)
  }

  async function handleCupSizeChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!sender) return
    
    const newSize = parseInt(e.target.value) || 250
    if (newSize <= 0 || newSize > 1000) return
    
    await supabase
      .from('user_settings')
      .upsert({
        user_name: sender,
        cup_size_ml: newSize,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_name'
      })
    
    setCupSizeMl(newSize)
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
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 导航栏 */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex space-x-1 py-3">
            <button
              onClick={() => setActiveTab('reminder')}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-colors duration-200 ${
                activeTab === 'reminder'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              remind and record
            </button>
            <button
              onClick={() => setActiveTab('log')}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-colors duration-200 ${
                activeTab === 'log'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              your water intake history
            </button>
          </div>
        </div>
      </nav>

      {/* 内容区域 */}
      <div className="flex-1">
        {activeTab === 'reminder' && (
          <div className="p-4 space-y-6">
            <div className="flex items-center justify-center">
              <div className="text-center max-w-2xl w-full">
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
          </div>
        )}

        {activeTab === 'log' && (
          <div className="max-w-2xl mx-auto px-4 py-8">
            {/* 顶部统计信息 */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Current User</p>
                  <p className="text-2xl font-bold text-blue-600">{sender || 'Not selected'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Today's Total</p>
                  <p className="text-2xl font-bold text-cyan-600">{todayTotalMl} ml</p>
                </div>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-6">your water intake history</h1>
            
            {drinkLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">no water intake history</p>
            ) : (
              <div className="space-y-3">
                {drinkLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white border border-slate-200 rounded-md px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-semibold text-blue-600">
                          {log.amount_ml} ml
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatTime(log.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}