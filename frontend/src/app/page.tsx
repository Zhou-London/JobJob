"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import InfoPanel, { type UserData } from "@/components/InfoPanel";
import DeliveryPanel from "@/components/DeliveryPanel";

// --- Types & Constants ---

type InputType = "text" | "choice" | "textarea" | "textarea-mic" | "file-or-skip";

interface ChatQuestion {
  botMessage: string;
  field: keyof UserData;
  inputType: InputType;
  options?: readonly string[];
  placeholder?: string;
  optional?: boolean;
}

const initialUserData: UserData = {
  cvFileName: "",
  name: "",
  jobPosition: "",
  jobType: "",
  school: "",
  major: "",
  degree: "",
  experience: "",
  nationality: "",
  gender: "",
  story: "",
};

const JOB_TYPES = ["Intern", "Full-time", "Part-time"] as const;
const DEGREES = ["Bachelor", "Master", "PhD", "Other"] as const;
const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"] as const;

const QUESTIONS: ChatQuestion[] = [
  { botMessage: "Do you have a CV?", field: "cvFileName", inputType: "file-or-skip" },
  { botMessage: "What's your name?", field: "name", inputType: "text", placeholder: "John Doe" },
  { botMessage: "What position are you looking for?", field: "jobPosition", inputType: "text", placeholder: "Software Engineer" },
  { botMessage: "What type of job?", field: "jobType", inputType: "choice", options: JOB_TYPES },
  { botMessage: "Where did you study?", field: "school", inputType: "text", placeholder: "MIT" },
  { botMessage: "What was your major?", field: "major", inputType: "text", placeholder: "Computer Science" },
  { botMessage: "What degree?", field: "degree", inputType: "choice", options: DEGREES },
  { botMessage: "Tell me about your experience", field: "experience", inputType: "textarea-mic", placeholder: "Describe your work experience, projects, or anything relevant..." },
  { botMessage: "What's your nationality?", field: "nationality", inputType: "text", placeholder: "British" },
  { botMessage: "How do you identify?", field: "gender", inputType: "choice", options: GENDERS },
  { botMessage: "Anything else you'd like to share?", field: "story", inputType: "textarea", placeholder: "Your story, motivation, or anything you'd like employers to know...", optional: true },
];

// --- Component ---

export default function Home() {
  const [phase, setPhase] = useState<"landing" | "chat" | "complete">("landing");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [userData, setUserData] = useState<UserData>(initialUserData);
  const [inputValue, setInputValue] = useState("");
  const [showDeliveryPanel, setShowDeliveryPanel] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasData = Object.values(userData).some((v) => v !== "");

  // Auto-focus input when question changes
  useEffect(() => {
    if (phase !== "chat") return;
    const q = QUESTIONS[questionIndex];
    if (!q) return;
    if (q.inputType === "text") {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else if (q.inputType === "textarea" || q.inputType === "textarea-mic") {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [phase, questionIndex]);

  const update = useCallback(
    (field: keyof UserData, value: string) =>
      setUserData((prev) => ({ ...prev, [field]: value })),
    []
  );

  const advanceToNextQuestion = useCallback(
    (currentIndex: number) => {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= QUESTIONS.length) {
        setPhase("complete");
        setShowDeliveryPanel(true);
      } else {
        setQuestionIndex(nextIndex);
        setInputValue("");
      }
    },
    []
  );

  // --- Handlers ---

  const handleStart = () => {
    setPhase("chat");
  };

  const handleSubmit = (value?: string) => {
    const q = QUESTIONS[questionIndex];
    const answer = value !== undefined ? value : inputValue.trim();
    if (!answer && !q.optional) return;

    if (answer) {
      update(q.field, answer);
    }
    setInputValue("");
    advanceToNextQuestion(questionIndex);
  };

  const handleCVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      update("cvFileName", file.name);
      advanceToNextQuestion(questionIndex);
    }
  };

  const handleCVSkip = () => {
    advanceToNextQuestion(questionIndex);
  };

  // --- Speech to text ---

  const toggleSpeech = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const w = window as Window &
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Record<string, any>;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition || null;

    if (!SR) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript) {
        setInputValue((prev) =>
          prev + (prev ? " " : "") + transcript.trim()
        );
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // --- Input area renderer ---

  const renderInput = () => {
    if (phase !== "chat" || questionIndex >= QUESTIONS.length) return null;
    const q = QUESTIONS[questionIndex];

    switch (q.inputType) {
      case "file-or-skip":
        return (
          <div className="chat-input-area flex gap-3 justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2.5 bg-black text-white rounded-full text-sm hover:bg-gray-800 transition-colors"
            >
              Upload CV
            </button>
            <button
              onClick={handleCVSkip}
              className="px-6 py-2.5 border border-gray-300 rounded-full text-sm text-gray-600 hover:border-gray-500 transition-colors"
            >
              Skip
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleCVUpload}
            />
          </div>
        );

      case "choice":
        return (
          <div className="chat-input-area flex gap-2 flex-wrap justify-center">
            {q.options?.map((opt) => (
              <button
                key={opt}
                onClick={() => handleSubmit(opt)}
                className="px-5 py-2.5 rounded-full text-sm border border-gray-300 text-gray-600 hover:bg-black hover:text-white hover:border-black transition-all"
              >
                {opt}
              </button>
            ))}
          </div>
        );

      case "text":
        return (
          <div className="chat-input-area">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="flex gap-2 items-center"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={q.placeholder}
                className="flex-1 border border-gray-200 rounded-full px-5 py-2.5 text-sm bg-transparent text-black placeholder-gray-300 focus:border-black focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="p-2.5 rounded-full bg-black text-white disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 7-7 7 7" />
                  <path d="M12 19V5" />
                </svg>
              </button>
            </form>
          </div>
        );

      case "textarea":
      case "textarea-mic":
        return (
          <div className="chat-input-area">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={q.placeholder}
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                className="w-full border border-gray-200 rounded-2xl px-5 py-3 text-sm bg-transparent text-black placeholder-gray-300 focus:border-black focus:outline-none transition-colors resize-none pr-20"
              />
              <div className="absolute bottom-3 right-3 flex gap-1.5">
                {q.inputType === "textarea-mic" && (
                  <button
                    type="button"
                    onClick={toggleSpeech}
                    className={`p-2 rounded-full transition-all ${
                      isListening
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                    title={isListening ? "Stop recording" : "Start speech-to-text"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={!inputValue.trim() && !q.optional}
                  className="p-2 rounded-full bg-black text-white disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 7-7 7 7" />
                    <path d="M12 19V5" />
                  </svg>
                </button>
              </div>
            </div>
            {q.optional && (
              <button
                onClick={() => {
                  setInputValue("");
                  advanceToNextQuestion(questionIndex);
                }}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Skip this question
              </button>
            )}
            {isListening && (
              <p className="mt-1 text-xs text-red-500">Listening...</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // --- Render ---

  if (phase === "landing") {
    return (
      <div className="h-screen flex items-center justify-center bg-white text-black">
        <div
          className="landing-enter cursor-pointer text-center select-none"
          onClick={handleStart}
        >
          <h1 className="text-6xl font-bold tracking-tight">Find your job</h1>
          <p className="mt-6 text-gray-400 text-lg">Click to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-white text-black">
      {/* Left info panel */}
      <div
        className={`transition-all duration-700 ease-in-out overflow-hidden flex-shrink-0 ${
          hasData ? "w-1/4 min-w-[260px] border-r border-gray-200" : "w-0"
        }`}
      >
        <InfoPanel userData={userData} />
      </div>

      {/* Center area — prompt + input, vertically centered */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-2xl text-center">
          {phase === "chat" && questionIndex < QUESTIONS.length && (
            <div key={questionIndex} className="chat-message">
              <h2 className="text-3xl font-semibold text-black mb-8">
                {QUESTIONS[questionIndex].botMessage}
              </h2>
              {renderInput()}
            </div>
          )}
          {phase === "complete" && (
            <div className="chat-message">
              <h2 className="text-3xl font-semibold">All set!</h2>
              <p className="mt-4 text-gray-400">
                We&apos;re processing your profile
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right delivery panel */}
      <div
        className={`transition-all duration-700 ease-in-out overflow-hidden flex-shrink-0 ${
          showDeliveryPanel
            ? "w-1/4 min-w-[260px] border-l border-gray-200"
            : "w-0"
        }`}
      >
        <DeliveryPanel />
      </div>
    </div>
  );
}
