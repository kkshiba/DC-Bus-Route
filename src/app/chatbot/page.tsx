"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getChatbotResponse, type ChatMessage } from "@/lib/chatbot";

const suggestedQuestions = [
  "Stops near me",
  "R102 stops",
  "From Toril District Hall to GE Torres Station",
  "What routes go to Matina Crossing?",
  "List all routes",
  "R403 info",
];

const initialMessage: ChatMessage = {
  id: "1",
  role: "assistant",
  content:
    "Hello! I'm the DC Bus Route assistant. I can help you find routes, stops, and directions around Davao City. How can I help you today?",
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {}
      );
    }
  }, []);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

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
      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));
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

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const showSuggestions = messages.length <= 2;

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base text-gray-900 dark:text-gray-100 leading-tight">
              AI Route Assistant
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary-500 flex-shrink-0" />
              Powered by AI to help you navigate
            </p>
          </div>
          {userLocation && (
            <div className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
              <MapPin className="w-3 h-3" />
              <span className="hidden sm:inline">Location active</span>
              <span className="sm:hidden">Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-3xl mx-auto p-4 space-y-5">
          {messages.length === 1 && !isTyping && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 flex items-center justify-center">
                <Bot className="w-7 h-7 text-primary-600 dark:text-primary-400" />
              </div>
              <p className="text-gray-400 dark:text-gray-500 text-sm max-w-xs">
                Ask me anything about DC Bus routes, stops, or directions in Davao City.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex gap-2.5 max-w-[90%] md:max-w-[80%] ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-primary-500 to-primary-700"
                      : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                  }`}
                >
                  {message.role === "user" ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  )}
                </div>

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
              <div className="flex gap-2.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center shadow-sm">
                  <Bot className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-tl-md shadow-sm">
                  <div className="flex gap-1.5 items-center h-4">
                    <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">

        {/* Suggestions — single scrollable row with fade edges */}
        {showSuggestions && (
          <div className="pt-2.5 pb-1">
            <div className="max-w-3xl mx-auto relative">
              {/* Fade on right edge */}
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-gray-800 to-transparent z-10" />
              {/* Fade on left edge */}
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-gray-800 to-transparent z-10" />
              <div className="flex gap-2 overflow-x-auto suggestions-scroll pb-1.5 px-4">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => sendMessage(question)}
                    className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-600 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all whitespace-nowrap"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex gap-2 items-center">
              {userLocation && (
                <div
                  className="hidden sm:flex flex-shrink-0 w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 items-center justify-center"
                  title="Location detected"
                >
                  <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
              )}
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask about routes, stops, or directions..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isTyping}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <Button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="flex-shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 shadow-md shadow-primary-600/20 disabled:opacity-50 disabled:shadow-none transition-all p-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {userLocation && (
              <p className="sm:hidden text-xs text-gray-400 dark:text-gray-500 mt-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-green-500" />
                Location detected
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}