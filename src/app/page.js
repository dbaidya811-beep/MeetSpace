"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [userName, setUserName] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState("");

  const createMeeting = () => {
    // Require name when creating meeting
    if (!userName) {
      setError("Please enter your name");
      return;
    }
    
    const userId = userName;
    const meetingId = uuidv4().substring(0, 8);
    
    // Store meeting info in localStorage for the meeting page
    localStorage.setItem("meetingInfo", JSON.stringify({
      meetingId,
      userId,
      isHost: true
    }));
    
    // Create invite link without name parameter
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/meeting/${meetingId}`;
    setInviteLink(link);
    setShowInviteModal(true);
    setShowJoinModal(false);
  };

  const joinMeeting = () => {
    if (!joinCode) {
      setError("Please enter meeting code");
      return;
    }
    
    // Require name when joining
    if (!userName) {
      setError("Please enter your name");
      return;
    }
    
    const userId = userName;
    
    localStorage.setItem("meetingInfo", JSON.stringify({
      meetingId: joinCode,
      userId,
      isHost: false
    }));
    
    router.push(`/meeting/${joinCode}`);
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    alert("Invite link copied!");
  };

  const startMeeting = () => {
    router.push(inviteLink);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">MeetSpace</h1>
        </div>
      </header>

      {/* Hero Section */}
      {/* Hero Section */}
      <main className="container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl lg:text-7xl font-bold text-gray-900 mb-4 md:mb-6">
            Video calls and meetings
            <span className="block text-blue-600">
              for everyone
            </span>
          </h2>
          <p className="text-base md:text-xl text-gray-600 mb-8 md:mb-12 max-w-2xl mx-auto">
            Connect with your team, friends, and family through high-quality video calls. 
            Create instant meetings or join existing ones with a simple link.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center items-center mb-8 md:mb-16">
            <button
              onClick={() => setShowJoinModal(true)}
              className="w-full sm:w-auto bg-blue-500 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl font-semibold text-base md:text-lg hover:bg-blue-600 transition-all duration-300 flex items-center justify-center gap-2 md:gap-3 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Meeting
            </button>
            
            <button
              onClick={() => setShowJoinModal(true)}
              className="w-full sm:w-auto bg-gray-200 text-gray-800 px-6 md:px-8 py-3 md:py-4 rounded-2xl font-semibold text-base md:text-lg hover:bg-gray-300 transition-all duration-300 flex items-center justify-center gap-2 md:gap-3 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Join Meeting
            </button>
          </div>

          {/* Join/Create Modal */}
          {showJoinModal && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">Join or Create Meeting</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-600 text-sm mb-2">Your Name</label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-4 py-3 rounded-2xl bg-gray-100 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="border-t border-gray-200 my-4 md:my-6"></div>

                  <button
                    onClick={createMeeting}
                    className="w-full bg-blue-500 text-white py-3 md:py-4 rounded-2xl font-semibold hover:bg-blue-600 transition-all shadow-md"
                  >
                    Create New Meeting
                  </button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-400">or</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-600 text-sm mb-2">Meeting Code</label>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="Enter meeting code"
                      className="w-full px-4 py-3 rounded-2xl bg-gray-100 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  {error && (
                    <p className="text-red-500 text-sm">{error}</p>
                  )}

                  <button
                    onClick={joinMeeting}
                    className="w-full bg-gray-200 text-gray-800 py-3 md:py-4 rounded-2xl font-semibold hover:bg-gray-300 transition-all"
                  >
                    Join Meeting
                  </button>
                </div>

                <button
                  onClick={() => {
                    setShowJoinModal(false);
                    setError("");
                  }}
                  className="absolute top-3 md:top-4 right-3 md:right-4 text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Invite Modal */}
          {showInviteModal && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
                <div className="text-center">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <svg className="w-6 h-6 md:w-8 md:h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Meeting Created!</h3>
                  <p className="text-gray-600 mb-4 md:mb-6 text-sm md:text-base">Share this link with others to invite them</p>
                  
                  <div className="bg-gray-100 rounded-2xl p-3 md:p-4 mb-4 md:mb-6">
                    <p className="text-gray-800 text-xs md:text-sm break-all">{inviteLink}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                    <button
                      onClick={copyInviteLink}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 md:py-3 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copy Link
                    </button>
                    <button
                      onClick={startMeeting}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 md:py-3 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Start Meeting
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteLink("");
                  }}
                  className="absolute top-3 md:top-4 right-3 md:right-4 text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 p-6 text-center text-gray-500 text-sm">
        Built with WebRTC & Socket.io
      </footer>
    </div>
  );
}
