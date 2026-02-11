"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { getChatbotResponse, type ChatMessage } from "@/lib/chatbot";

const suggestedQuestions = [
  "What is the nearest DC Bus stop from my location?",
  "Where should I get off if I'm going to SM Ecoland?",
  "What are all the stops on this route?",
  "How do I get from SM Lanang to Bankerohan?",
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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
          <Bot className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h1 className="font-semibold text-gray-900">AI Route Assistant</h1>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-xs text-gray-500">Online</span>
          </div>
        </div>
      </div>

      {/* Suggested Questions */}
      <div className="bg-white border-b px-4 py-3">
        <p className="text-xs text-gray-500 mb-2">Suggested questions:</p>
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => handleSuggestedQuestion(question)}
              className="text-xs px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`flex gap-2 max-w-[85%] md:max-w-[70%] ${
                message.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === "user"
                    ? "bg-primary-600"
                    : "bg-gray-200"
                }`}
              >
                {message.role === "user" ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-gray-600" />
                )}
              </div>

              {/* Message Bubble */}
              <div>
                <div
                  className={`px-4 py-2 rounded-2xl ${
                    message.role === "user"
                      ? "bg-primary-600 text-white rounded-tr-sm"
                      : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                <p
                  className={`text-xs text-gray-400 mt-1 ${
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
            <div className="flex gap-2 max-w-[85%] md:max-w-[70%]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <Bot className="w-4 h-4 text-gray-600" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-white border border-gray-200 rounded-tl-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Type your question here..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1"
            disabled={isTyping}
          />
          <Button
            type="submit"
            disabled={!inputValue.trim() || isTyping}
            className="bg-primary-600 hover:bg-primary-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        {userLocation && (
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Location detected - I can find stops near you
          </p>
        )}
      </div>
    </div>
  );
}
