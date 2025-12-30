"use client"
import { supabase } from '@/lib/supabase'
import {useState, useEffect} from 'react'
import toast from 'react-hot-toast'

export default function Home() {
  const [message, setMessage] = useState('')
  const [sender, setSender] = useState('')
  const [lastMessage, setLastMessage] = useState('')

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
  }, [])

  async function handleclick() {
    if(!sender || !message) {
      toast.error('Please enter a sender and message') 
      return
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