"use client";

import { useState } from "react";
import { Star, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFeedbackStore } from "@/stores/feedback-store";
import { submitTripFeedback } from "@/lib/feedback-service";

export function FeedbackModal() {
  const {
    isModalOpen,
    tripData,
    isSubmitting,
    closeFeedbackModal,
    setSubmitting,
    markSubmitted,
  } = useFeedbackStore();

  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState("");

  if (!isModalOpen || !tripData) {
    return null;
  }

  const handleSubmit = async () => {
    if (rating === 0) return;

    setSubmitting(true);

    const result = await submitTripFeedback({
      ...tripData,
      starRating: rating,
      comment: comment.trim() || null,
    });

    setSubmitting(false);

    if (result.success) {
      markSubmitted();
      // Reset local state
      setRating(0);
      setComment("");
    } else {
      alert("Failed to submit feedback. Please try again.");
    }
  };

  const handleSkip = () => {
    closeFeedbackModal();
    setRating(0);
    setComment("");
  };

  const getRatingLabel = (r: number) => {
    switch (r) {
      case 1:
        return "Poor";
      case 2:
        return "Fair";
      case 3:
        return "Good";
      case 4:
        return "Very Good";
      case 5:
        return "Excellent";
      default:
        return "";
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 border-2 border-primary-500">
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            How was your trip?
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Your feedback helps us improve
          </p>
        </div>

        {/* Star Rating */}
        <div className="flex justify-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  "w-10 h-10 transition-colors",
                  (hoveredRating || rating) >= star
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-300 dark:text-gray-600"
                )}
              />
            </button>
          ))}
        </div>

        {/* Rating label */}
        <div className="h-6 mb-4">
          {(hoveredRating || rating) > 0 && (
            <p className="text-center text-sm font-medium text-gray-700 dark:text-gray-300">
              {getRatingLabel(hoveredRating || rating)}
            </p>
          )}
        </div>

        {/* Comment textarea */}
        <div className="mb-6">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us more about your experience (optional)"
            className="w-full h-24 px-4 py-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            maxLength={500}
          />
          <p className="text-xs text-gray-400 text-right mt-1">
            {comment.length}/500
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleSkip}
            variant="outline"
            className="flex-1"
            disabled={isSubmitting}
          >
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1 bg-primary-600 hover:bg-primary-700"
            disabled={rating === 0 || isSubmitting}
          >
            {isSubmitting ? (
              "Submitting..."
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
