import { FormEvent, useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { askMarisAi } from "../../api";
import marisAssistantHeadUrl from "../../assets/maris-assistant-head.png";

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  content: string;
};

const starterMessages: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    content: "Hello. I am RAPID-AI. Ask me about marine life, biodiversity, coral reefs, sea temperature, chlorophyll, or ocean health.",
  },
];

const suggestedQuestions = [
  "Why is chlorophyll important?",
  "How does warm water affect coral reefs?",
  "What does biodiversity index mean?",
];

export function CopilotPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [isOpen, messages]);

  async function sendMessage(text = draft) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const now = Date.now();
    const pendingId = now + 1;

    setMessages((current) => [
      ...current,
      { id: now, role: "user", content: trimmed },
      { id: pendingId, role: "assistant", content: "RAPID-AI is analyzing..." },
    ]);
    setDraft("");
    setIsSending(true);

    try {
      const response = await askMarisAi(trimmed);
      setMessages((current) =>
        current.map((message) => message.id === pendingId ? { ...message, content: response } : message),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "The RAPID-AI service is unavailable.";
      setMessages((current) =>
        current.map((item) =>
          item.id === pendingId
            ? { ...item, content: `I could not reach the RAPID-AI service. ${message}` }
            : item,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage();
  }

  return (
    <>
      <button className="maris-logo-icon" type="button" aria-label="Open RAPID-AI chat" onClick={() => setIsOpen(true)}>
        <img className="maris-assistant-head" src={marisAssistantHeadUrl} alt="" aria-hidden="true" />
        <span className="maris-assistant-eye left" aria-hidden="true" />
        <span className="maris-assistant-eye right" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="marine-chat-backdrop" role="dialog" aria-modal="true" aria-label="RAPID-AI marine life chat">
          <section className="marine-chat-window">
            <header className="marine-chat-header">
              <span className="marine-chat-logo marine-chat-logo-image" aria-hidden="true">
                <img src={marisAssistantHeadUrl} alt="" />
              </span>
              <div>
                <h2>RAPID-AI</h2>
                <p>Marine life assistant</p>
              </div>
              <button type="button" aria-label="Close chat" onClick={() => setIsOpen(false)}>
                <X size={20} />
              </button>
            </header>

            <div className="marine-chat-messages" ref={messagesRef}>
              {messages.map((message) => (
                <article key={message.id} className={`marine-chat-message ${message.role}`}>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>

            <div className="marine-chat-suggestions" aria-label="Suggested questions">
              {suggestedQuestions.map((question) => (
                <button key={question} type="button" disabled={isSending} onClick={() => void sendMessage(question)}>
                  {question}
                </button>
              ))}
            </div>

            <form className="marine-chat-input" onSubmit={handleSubmit}>
              <input
                value={draft}
                onChange={(event) => setDraft(event.currentTarget.value)}
                placeholder="Ask about marine life..."
                aria-label="Ask RAPID-AI"
                disabled={isSending}
              />
              <button type="submit" aria-label="Send message" disabled={isSending}>
                <Send size={18} />
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
