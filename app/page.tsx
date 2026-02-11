"use client"
import { supabase } from '@/lib/supabase'
import {useState, useEffect, useRef, useCallback} from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type Message = {
  id: string
  sender: string
  receiver?: string
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

// 消息发送者名称组件（显示昵称）
function MessageSenderName({ senderEmail }: { senderEmail: string }) {
  const [nickname, setNickname] = useState<string>(senderEmail.split('@')[0])
  
  useEffect(() => {
    const fetchNickname = async () => {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('nickname')
        .eq('email', senderEmail)
        .maybeSingle()
      
      if (profile?.nickname) {
        setNickname(profile.nickname)
      }
    }
    
    fetchNickname()
  }, [senderEmail])
  
  return <span className="text-sm font-semibold text-gray-900">{nickname}:</span>
}

function MessageReceiverName({ receiverEmail }: { receiverEmail: string }) {
  const [nickname, setNickname] = useState<string>(receiverEmail ? receiverEmail.split('@')[0] : '')
  
  useEffect(() => {
    if (!receiverEmail) {
      setNickname('')
      return
    }
    
    const fetchNickname = async () => {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('nickname')
        .eq('email', receiverEmail)
        .maybeSingle()
      
      if (profile?.nickname) {
        setNickname(profile.nickname)
      }
    }
    
    fetchNickname()
  }, [receiverEmail])
  
  if (!nickname) return null
  
  return <span className="text-sm font-semibold text-gray-900">{nickname}</span>
}


async function getReceiverEmail(currentEmail: string): Promise<string | null> {
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('email')
    .neq('email', currentEmail)
  
  return profiles?.[0]?.email || null
}

export default function Home() {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userNickname, setUserNickname] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sentMessages, setSentMessages] = useState<Message[]>([])
  const [todayTotalMl, setTodayTotalMl] = useState(0)
  const [cupSizeMl, setCupSizeMl] = useState(250)
  const [activeTab, setActiveTab] = useState<'reminder' | 'log' | 'profile'>('reminder')
  const [drinkLogs, setDrinkLogs] = useState<DrinkLog[]>([])
  const [profileNickname, setProfileNickname] = useState<string>('')
  const [savingNickname, setSavingNickname] = useState(false)
  const [receiverNickname, setReceiverNickname] = useState<string>('')
  const [selectedReceiverEmail, setSelectedReceiverEmail] = useState<string>('')
  const [availableUsers, setAvailableUsers] = useState<Array<{email: string, nickname: string}>>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const audioContextRef = useRef<AudioContext | null>(null)

  const fetchUserProfile = useCallback(async () => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user?.email) {
      router.push('/login')
      return
    }

    const email = session.user.email
    setUserEmail(email)

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('nickname')
      .eq('email', email)
      .maybeSingle()

    // 如果用户档案不存在，自动创建一个默认档案（使用邮箱前缀作为昵称）
    if (!profile) {
      const defaultNickname = email.split('@')[0]
      await supabase
        .from('user_profiles')
        .upsert({
          email: email,
          nickname: defaultNickname,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'email'
        })
      setUserNickname(defaultNickname)
      setProfileNickname(defaultNickname)
    } else {
      const nickname = profile.nickname
      setUserNickname(nickname)
      setProfileNickname(nickname)
    }
  }, [router])

  const fetchAvailableUsers = useCallback(async () => {
    if (!userEmail) {
      setAvailableUsers([])
      setSelectedReceiverEmail('')
      return
    }
    
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('email, nickname')
      .neq('email', userEmail)
      .order('nickname')
    
    if (profiles && profiles.length > 0) {
      setAvailableUsers(profiles)
      if (!selectedReceiverEmail || !profiles.find(p => p.email === selectedReceiverEmail)) {
        setSelectedReceiverEmail(profiles[0].email)
      }
    } else {
      setAvailableUsers([])
      setSelectedReceiverEmail('')
    }
  }, [userEmail, selectedReceiverEmail])

  const fetchReceiverNickname = useCallback(async () => {
    if (!selectedReceiverEmail) {
      setReceiverNickname('')
      return
    }
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('nickname')
      .eq('email', selectedReceiverEmail)
      .maybeSingle()
    
    setReceiverNickname(profile?.nickname || selectedReceiverEmail.split('@')[0])
  }, [selectedReceiverEmail])

  const fetchMessages = useCallback(async () => {
    if (!userEmail) {
      setMessages([])
      return
    }
    
    const { data } = await supabase
      .from('message')
      .select('*')
      .eq('receiver', userEmail)
      .order('created_at', { ascending: false })
      .limit(5)
    
    setMessages(data || [])
  }, [userEmail])


  const fetchSentMessages = useCallback(async() => {
    if (!userEmail) {
      setSentMessages([])
      return
    }
    
    const { data } = await supabase
      .from('message')
      .select('*')
      .eq('sender', userEmail)
      .order('created_at', { ascending: false })
      .limit(5)
    
    setSentMessages(data || [])
  }, [userEmail])

  const fetchTodayTotalMl = useCallback(async () => {
    if (!userEmail) {
      setTodayTotalMl(0)
      return
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.toISOString()
    
    const { data } = await supabase
      .from('drink_logs')
      .select('amount_ml')
      .eq('user_name', userEmail)
      .gte('created_at', todayStart)
    
    const total = data?.reduce((sum, log) => sum + log.amount_ml, 0) || 0
    setTodayTotalMl(total)
  }, [userEmail])

  const fetchUserSettings = useCallback(async () => {
    if (!userEmail) {
      setCupSizeMl(250)
      return
    }
    
    const { data } = await supabase
      .from('user_settings')
      .select('cup_size_ml')
      .eq('user_name', userEmail)
      .single()
    
    if (data?.cup_size_ml) {
      setCupSizeMl(data.cup_size_ml)
    }
  }, [userEmail])

  const fetchDrinkLogs = useCallback(async () => {
    if (!userEmail) {
      setDrinkLogs([])
      return
    }
    
    const { data } = await supabase
      .from('drink_logs')
      .select('*')
      .eq('user_name', userEmail)
      .order('created_at', { ascending: false })
      .limit(50)
    
    setDrinkLogs(data || [])
  }, [userEmail])


  useEffect(() => {
    const checkAuthAndFetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      await fetchUserProfile()
    }

    checkAuthAndFetchProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session) {
          router.push('/login')
        } else {
          await fetchUserProfile()
        }
      }
    )

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
      subscription.unsubscribe()
      supabase.removeChannel(channel)
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [router, fetchUserProfile])

  useEffect(() => {
    if (userEmail) {
      fetchMessages()
      fetchSentMessages()
      fetchTodayTotalMl()
      fetchUserSettings()
      fetchDrinkLogs()
      fetchAvailableUsers()
    } else {
      setMessages([])
      setSentMessages([])
      setTodayTotalMl(0)
      setCupSizeMl(250)
      setDrinkLogs([])
      setReceiverNickname('')
      setAvailableUsers([])
      setSelectedReceiverEmail('')
    }
  }, [userEmail, fetchMessages, fetchSentMessages, fetchTodayTotalMl, fetchUserSettings, fetchDrinkLogs, fetchAvailableUsers])

  useEffect(() => {
    if (selectedReceiverEmail) {
      fetchReceiverNickname()
    } else {
      setReceiverNickname('')
    }
  }, [selectedReceiverEmail, fetchReceiverNickname])

  function handleNewMessage(newMessage: Message) {
    if (!userEmail) return

    if (newMessage.receiver === userEmail) {
      showNotification(newMessage)
      playNotificationSound()
      toast.success(`收到来自 ${newMessage.sender} 的提醒！`)
      fetchMessages()
    }
    
    if (newMessage.sender === userEmail) {
      fetchSentMessages()
    }
  }

  function handleMessageUpdate(updatedMessage: Message) {
    if (!userEmail) return

    if (updatedMessage.sender === userEmail) {
      setSentMessages(prev => prev.map(msg => 
        msg.id === updatedMessage.id ? updatedMessage : msg
      ))
    } else if (updatedMessage.receiver === userEmail) {
      setMessages(prev => prev.map(msg => 
        msg.id === updatedMessage.id ? updatedMessage : msg
      ))
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

  async function handleDrink(amountMl: number) {
    if (!userEmail) return
    
    await supabase
      .from('drink_logs')
      .insert([{ user_name: userEmail, amount_ml: amountMl }])
    
    await fetchTodayTotalMl()
    await fetchDrinkLogs()
    toast.success(`Recorded ${amountMl}ml!`)
  }

  async function handleCupSizeChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!userEmail) return
    
    const newSize = parseInt(e.target.value) || 250
    if (newSize <= 0 || newSize > 1000) return
    
    await supabase
      .from('user_settings')
      .upsert({
        user_name: userEmail,
        cup_size_ml: newSize,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_name'
      })
    
    setCupSizeMl(newSize)
  }

  async function handleclick() {
    if (!userEmail || !message) {
      toast.error('Please enter a message') 
      return
    }
    
    if (!selectedReceiverEmail) {
      toast.error('Please select a receiver')
      return
    }
    
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume()
    }
    
    const { error } = await supabase
      .from('message')
      .insert([
        { 
          sender: userEmail,
          receiver: selectedReceiverEmail,
          message: message     
        }
      ])
    
    if (error) {
      toast.error('Failed to send message')
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

   async function handleSaveNickname(e: React.FormEvent) {
    e.preventDefault()
    
    if (!profileNickname.trim() || !userEmail) return

    setSavingNickname(true)

    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        email: userEmail,
        nickname: profileNickname.trim(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'email'
      })

    setSavingNickname(false)

    if (error) {
      toast.error('Failed to save nickname')
      return
    }

    setUserNickname(profileNickname.trim())
    toast.success('Nickname saved')
  }

  async function handleAddFriend(friendEmail: string, friendNickname: string) {
    toast.success(`Added ${friendNickname} as friend!`)
  }

  const filteredUsers = availableUsers.filter(user => 
    user.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 导航栏 */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex space-x-1 flex-1">
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
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  activeTab === 'profile'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                profile
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 内容区域 */}
      <div className="flex-1">
        {activeTab === 'reminder' && (
          <div className="max-w-4xl mx-auto p-4 space-y-6">
            {/* remind friend card */}
            {userNickname && (
              <p className="text-sm text-gray-500 text-center">
                Logged in as <span className="font-semibold text-gray-800">{userNickname}</span>
              </p>
            )}

            {/* Two-column card grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Remind a Friend */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Remind a Friend</h2>

                {availableUsers.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select a friend:
                    </label>
                    <select
                      value={selectedReceiverEmail}
                      onChange={(e) => setSelectedReceiverEmail(e.target.value)}
                      className="w-full bg-transparent text-slate-700 text-sm border border-slate-200 rounded-md px-3 py-2 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-300 shadow-sm focus:shadow"
                    >
                      {availableUsers.length === 1 ? (
                        <option value={availableUsers[0].email}>
                          {availableUsers[0].nickname}
                        </option>
                      ) : (
                        <>
                          <option value="">Select a friend</option>
                          {availableUsers.map(user => (
                            <option key={user.email} value={user.email}>
                              {user.nickname}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    {selectedReceiverEmail && receiverNickname && (
                      <p className="text-sm text-gray-500 mt-2">
                        Reminding: <span className="font-semibold text-gray-700">{receiverNickname}</span>
                      </p>
                    )}
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-transparent placeholder:text-slate-400 text-slate-700 text-sm border border-slate-200 rounded-md px-3 py-2 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-300 shadow-sm focus:shadow mb-4"
                />

                <button
                  onClick={handleclick}
                  className="mt-auto w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Tap to remind your friend
                </button>
              </div>

              {/*Water Intake card*/}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Water Intake</h2>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                  <p className="text-lg font-semibold text-blue-900">
                    Today&apos;s Total: {todayTotalMl} ml
                  </p>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <label className="text-sm text-gray-700 whitespace-nowrap">Cup Size (ml):</label>
                  <input
                    type="number"
                    min="50"
                    max="1000"
                    value={cupSizeMl}
                    onChange={handleCupSizeChange}
                    className="w-24 bg-transparent text-slate-700 text-sm border border-slate-200 rounded-md px-3 py-2 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-300 shadow-sm focus:shadow"
                  />
                </div>

                <div className="mt-auto grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleDrink(50)}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
                  >
                    Sip (+50ml)
                  </button>
                  <button
                    onClick={() => handleDrink(Math.floor(cupSizeMl / 2))}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
                  >
                    Half (+{Math.floor(cupSizeMl / 2)}ml)
                  </button>
                  <button
                    onClick={() => handleDrink(cupSizeMl)}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
                  >
                    Full (+{cupSizeMl}ml)
                  </button>
                </div>
              </div>
            </div>

            {/* Received Messages */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Received Messages</h2>

              {messages.length === 0 ? (
                <p className="text-gray-500 text-sm">暂无消息</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className="bg-gray-50 border border-slate-200 rounded-md px-4 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <MessageSenderName senderEmail={msg.sender} />
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

            {/* Sent Messages */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Messages You Sent</h2>

              {sentMessages.length === 0 ? (
                <p className="text-gray-500 text-sm">暂无消息</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {sentMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="bg-gray-50 border border-slate-200 rounded-md px-4 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-900">You →</span>
                          <MessageReceiverName receiverEmail={msg.receiver || ''} />
                          <span className="text-sm text-gray-700">:</span>
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
        )}

        {activeTab === 'log' && (
          <div className="max-w-2xl mx-auto px-4 py-8">
            {/* 顶部统计信息 */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Current User</p>
                  <p className="text-2xl font-bold text-blue-600">{userNickname || 'Loading...'}</p>
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

        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Profile</h1>
            
            <form onSubmit={handleSaveNickname} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={userEmail || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nickname
                </label>
                <input
                  type="text"
                  value={profileNickname}
                  onChange={(e) => setProfileNickname(e.target.value)}
                  placeholder="Enter your nickname"
                  required
                  disabled={savingNickname}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              <button
                type="submit"
                disabled={savingNickname}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors font-medium"
              >
                {savingNickname ? 'Saving...' : 'Save'}
              </button>
            </form>

            <div className="mt-12 pt-8 border-t border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Add Friends</h2>
              
              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users by name or email..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {filteredUsers.length > 0 && (
                <div className="space-y-3">
                  {filteredUsers.map(user => (
                    <div
                      key={user.email}
                      className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{user.nickname}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <button
                        onClick={() => handleAddFriend(user.email, user.nickname)}
                        className="ml-4 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        Add Friend
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}