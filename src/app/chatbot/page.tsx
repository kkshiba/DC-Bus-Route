"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, MapPin, Sparkles, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getChatbotResponse, type ChatMessage } from "@/lib/chatbot";

const suggestedQuestions = [
  "What routes go to SM Ecoland?",
  "Find stops near me",
  "How to get from SM Lanang to Bankerohan?",
  "What are the bus stops on Route 1?",
];

const initialMessage: ChatMessage = {
  id: "1",
  role: "assistant",
  content:
    "Hello! I'm the DC Bus Route assistant. I can help you find routes, stops, and directions. How can I help you today?",
  timestamp: new Date(),
};

export default function Chatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // Silently fail - location is optional
        }
      );
    }
  }, []);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    try {
      // Simulate typing delay
      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));

      // Get bot response from Gemini API
      const response = await getChatbotResponse(content, userLocation);
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setIsTyping(false);
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error getting chatbot response:", error);
      setIsTyping(false);

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Show suggestions only when there's just the initial message
  const showSuggestions = messages.length <= 2;

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></span>
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100">
              AI Route Assistant
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary-500" />
              Powered by AI to help you navigate
            </p>
          </div>
          {userLocation && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
              <MapPin className="w-3.5 h-3.5" />
              Location active
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`flex gap-3 max-w-[90%] md:max-w-[80%] ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-primary-500 to-primary-700"
                      : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                  }`}
                >
                  {message.role === "user" ? (
                    <User className="w-5 h-5 text-white" />
                  ) : (
                    <Bot className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  )}
                </div>

                {/* Message Bubble */}
                <div className="space-y-1">
                  <div
                    className={`px-4 py-3 rounded-2xl shadow-sm ${
                      message.role === "user"
                        ? "bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-tr-md"
                        : "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-md"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                  <p
                    className={`text-xs text-gray-400 dark:text-gray-500 px-1 ${
                      message.role === "user" ? "text-right" : ""
                    }`}
                  >
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[90%] md:max-w-[80%]">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center shadow-sm">
                  <Bot className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="px-5 py-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-tl-md shadow-sm">
                  <div className="flex gap-1.5">
                    <span
                      className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></span>
                    <span
                      className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    ></span>
                    <span
                      className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    ></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom Section - Suggestions + Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {/* Suggestions - Above input */}
        {showSuggestions && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <div className="max-w-3xl mx-auto">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" />
                Try asking:
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedQuestion(question)}
                    className="text-xs px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-600 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all shadow-sm"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-4 py-4">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex gap-3 items-end">
              {/* Location Indicator */}
              {userLocation && (
                <div className="hidden sm:flex flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 items-center justify-center" title="Location detected">
                  <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
              )}

              {/* Input Field */}
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Ask about routes, stops, or directions..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={isTyping}
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Send Button */}
              <Button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 shadow-lg shadow-primary-600/25 disabled:opacity-50 disabled:shadow-none transition-all"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>

            {/* Mobile Location Indicator */}
            {userLocation && (
              <p className="sm:hidden text-xs text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-green-500" />
                Location detected - I can find stops near you
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
