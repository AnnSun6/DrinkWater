'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        setError(error.message)
        setTimeout(() => router.push('/login'), 2000)
        return
      }

      if (data.session) {
        router.push('/')
      } else {
        setError('please try again')
        setTimeout(() => router.push('/login'), 2000)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-red-500 text-lg mb-4">{error}</p>
            <p className="text-gray-500">returning to login page...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">verifying login...</p>
          </>
        )}
      </div>
    </div>
  )
}