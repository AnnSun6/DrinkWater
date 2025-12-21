"use client"

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Click to remind your friend to drink water
        </h1>
        
        <button 
          onClick={() => alert('The message has been sent!')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg"
        >
          Drink one sip of water
        </button>
      </div>
    </div>
  );
}