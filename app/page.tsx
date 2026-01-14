"use client"
import { supabase } from '@/lib/supabase'
import {useState, useEffect, useRef, useCallback} from 'react'
import toast from 'react-hot-toast'

// 定义消息类型，用于 TypeScript 类型检查.类型安全：确保数据结构一致，避免运行时错误
// 为什么需要这个类型？
type Message = {
  id: string          // 消息唯一标识（UUID）
  sender: string     // 发送者名字
  message: string    // 消息内容
  created_at: string // 创建时间（ISO 8601 格式）
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
  // 修改：从单个字符串改为消息数组,可以存储多条消息的完整信息
  const [messages, setMessages] = useState<Message[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)


  // 查询消息函数：根据当前身份筛选"收到的消息"

  const fetchMessages = useCallback(async () => {
    // 如果未选择身份，清空消息列表
    if (!sender) {
      setMessages([])
      return
    }

  
    const receiver = getReceiverName(sender)
    if (!receiver) {
      setMessages([])
      return
    }

    // 只查询对方发送给我的消息
    const { data, error } = await supabase
      .from('message')
      .select('*')  // 获取所有字段：id, sender, message, created_at
      .eq('sender', receiver)  // 筛选条件：只查询 sender === receiver 的消息
      .order('created_at', { ascending: false })  // 按时间倒序,最新的在前
      .limit(5)    // 只取最近5条

    // 错误处理：如果查询失败，显示错误提示
    if (error) {
      console.error('查询消息失败:', error)
      toast.error('加载消息失败')
      return
    }

    // data 可能是数组或 null，用 || [] 确保是数组,如果 data 是 null，使用空数组，避免后续 .map() 报错
    setMessages(data || [])
  }, [sender])  // sender身份变化时，函数会自动更新

  useEffect(() => {
    // 从 localStorage 恢复身份选择
    const savedSender = localStorage.getItem('my_name')
    if (savedSender === 'Ann' || savedSender === 'Sid') {
      setSender(savedSender)
    }


    // 新的 useEffect 会监听 sender 变化并自动调用 fetchMessages


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
        // 类型断言从 { sender, message } 改为 Message,因为payload.new 包含完整消息信息（id, sender, message, created_at）。使用 Message 类型更准确，符合类型安全原则
        handleNewMessage(payload.new as Message)
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

  // 监听身份变化，自动重新查询消息
  useEffect(() => {
    if (sender) {
      // 如果已选择身份，查询对应的消息
      fetchMessages()
    } else {
      // 如果未选择身份，清空消息列表
      setMessages([])
    }
  }, [sender, fetchMessages])  // sender 和 fetchMessages，当身份变化时自动重新查询

  //处理新消息,当 Supabase Realtime 监听到新消息插入时调用
  function handleNewMessage(newMessage: Message) {

    if (!sender) return

    const receiver = getReceiverName(sender)
    
    // 只有对方发给我的消息才显示通知
    if (receiver && newMessage.sender === receiver) {
      // 显示通知（浏览器通知 + Toast + 音频）
      showNotification(newMessage)
      playNotificationSound()
      toast.success(`收到来自 ${newMessage.sender} 的提醒！`)
      
      // 重新获取消息列表,重新查询确保数据一致性
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
        </div>
      </div>
    </div>
  );
}