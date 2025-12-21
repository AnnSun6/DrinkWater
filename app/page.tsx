"use client"
/*function test_function() {
  console.log("test ESLint");
}

function testfunction() {
  console.log("test ESLint");
}

function TestFunction() {
  console.log("test ESLint");
}*/

export default function Home() {
  function handleclick() {
    alert('The message has been sent!');
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Click to remind your friend to drink water
        </h1>
        
        <button 
          onClick={handleclick}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg"
        >
          Drink one sip of water
        </button>
      </div>
    </div>
  );
}