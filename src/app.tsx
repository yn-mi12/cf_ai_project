/** biome-ignore-all lint/correctness/useUniqueElementIds: it's alright */
import { useEffect, useState, useRef, useCallback } from "react";
import { useAgent } from "agents/react";
import { isToolUIPart } from "ai";
import { useAgentChat } from "agents/ai-react";
import type { UIMessage } from "@ai-sdk/react";

// Component imports
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Avatar } from "@/components/avatar/Avatar";
import { Toggle } from "@/components/toggle/Toggle";
import { Textarea } from "@/components/textarea/Textarea";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import { ToolInvocationCard } from "@/components/tool-invocation-card/ToolInvocationCard";

// Icon imports
import {
  Bug,
  Moon,
  Palette,
  Sun,
  Trash,
  PaperPlaneTilt,
  Stop,
  Camera
} from "@phosphor-icons/react";
import icon from "./media/icon.png";

export default function Chat() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    // Check localStorage first, default to dark if not found
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme as "dark" | "light") || "dark";
  });
  const [showDebug, setShowDebug] = useState(false);
  const [textareaHeight, setTextareaHeight] = useState("auto");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    // Apply theme class on mount and when theme changes
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }

    // Save theme preference to localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Scroll to bottom on mount
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  const agent = useAgent({
    agent: "chat"
  });

  const [agentInput, setAgentInput] = useState("");
  const handleAgentInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setAgentInput(e.target.value);
  };

  const handleAgentSubmit = async (
    e: React.FormEvent,
    extraData: Record<string, unknown> = {}
  ) => {
    e.preventDefault();
    if (!agentInput.trim()) return;

    const message = agentInput;
    setAgentInput("");

    // Send message to agent
    await sendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: message }]
      },
      {
        body: extraData
      }
    );
  };

  const {
    messages: agentMessages,
    addToolResult,
    clearHistory,
    status,
    sendMessage,
    stop
  } = useAgentChat<unknown, UIMessage<{ createdAt: string }>>({
    agent
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    agentMessages.length > 0 && scrollToBottom();
  }, [agentMessages, scrollToBottom]);

  const pendingToolCallConfirmation = agentMessages.some((m: UIMessage) =>
    m.parts?.some(
      (part) => isToolUIPart(part) && part.state === "input-available"
      // &&
      // Manual check inside the component
      // toolsRequiringConfirmation.includes(
      //   part.type.replace("tool-", "") as keyof typeof tools
      // )
    )
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="h-[100vh] w-full p-4 flex justify-center items-center bg-white overflow-hidden">
      {/* <HasOpenAIKey /> */}
      <div className="h-[calc(100vh-2rem)] w-full mx-auto max-w-lg flex flex-col shadow-xl rounded-md overflow-hidden relative border border-purple-200/50 dark:border-neutral-700 bg-gradient-to-br from-purple-50/60 via-blue-50/70 to-indigo-100/80 dark:from-slate-800 dark:via-slate-900 dark:to-neutral-900">
        <div className="px-4 py-3 border-b border-purple-200/40 dark:border-neutral-700 flex items-center gap-3 sticky top-0 z-10 bg-gradient-to-r from-purple-100/70 via-blue-100/80 to-indigo-100/70 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-center h-8 w-8">
            <Camera size={28} className="text-[#60A5FA]" />
          </div>

          <div className="flex-1">
            <h2 className="font-semibold text-base text-slate-800 dark:text-white">
              Your Photography Assistant
            </h2>
          </div>

          <div className="flex items-center gap-2 mr-2">
            <Bug size={16} />
            <Toggle
              toggled={showDebug}
              aria-label="Toggle debug mode"
              onClick={() => setShowDebug((prev) => !prev)}
            />
          </div>

          <Button
            variant="ghost"
            size="md"
            shape="square"
            className="rounded-full h-9 w-9"
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </Button>

          <Button
            variant="ghost"
            size="md"
            shape="square"
            className="rounded-full h-9 w-9"
            onClick={clearHistory}
          >
            <Trash size={20} />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 max-h-[calc(100vh-10rem)]">
          {agentMessages.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <Card className="p-6 max-w-md mx-auto bg-gradient-to-br from-purple-100/80 via-blue-100/70 to-indigo-100/90 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 backdrop-blur-sm border-purple-200/50 dark:border-neutral-700">
                <div className="text-center space-y-4">
                  <div className="bg-[#60A5FA]/20 text-[#60A5FA] rounded-full p-3 inline-flex">
                    <Palette size={24} />
                  </div>
                  <h3 className="font-semibold text-lg text-slate-800 dark:text-white">
                    Welcome to Unsplash Chat
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm">
                    Start a conversation with your AI assistant. Try asking
                    about:
                  </p>
                  <ul className="text-sm text-left space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="text-[#60A5FA]">•</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        A specific image by describing it
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#60A5FA]">•</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        A group of images by giving the description and
                        specifying the number of results you want
                      </span>
                    </li>
                  </ul>
                </div>
              </Card>
            </div>
          )}

          {agentMessages.map((m, index) => {
            const isUser = m.role === "user";
            const showAvatar =
              index === 0 || agentMessages[index - 1]?.role !== m.role;

            return (
              <div key={m.id}>
                {showDebug && (
                  <pre className="text-xs text-muted-foreground overflow-scroll">
                    {JSON.stringify(m, null, 2)}
                  </pre>
                )}
                <div
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex gap-2 max-w-[85%] ${
                      isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {showAvatar && !isUser ? (
                      <Avatar
                        username={"AI"}
                        image={icon}
                        className="flex-shrink-0"
                      />
                    ) : (
                      !isUser && <div className="w-8" />
                    )}

                    <div>
                      <div>
                        {m.parts?.map((part, i) => {
                          if (part.type === "text") {
                            return (
                              // biome-ignore lint/suspicious/noArrayIndexKey: immutable index
                              <div key={i}>
                                <Card
                                  className={`p-3 rounded-md ${
                                    isUser
                                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 rounded-br-none text-white"
                                      : "bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-600 dark:to-indigo-600 rounded-bl-none border-assistant-border text-white"
                                  } ${
                                    part.text.startsWith("scheduled message")
                                      ? "border-accent/50"
                                      : ""
                                  } relative shadow-lg`}
                                >
                                  {part.text.startsWith(
                                    "scheduled message"
                                  ) && (
                                    <span className="absolute -top-3 -left-2 text-base">
                                      🕒
                                    </span>
                                  )}
                                  <MemoizedMarkdown
                                    content={part.text.replace(
                                      /^scheduled message: /,
                                      ""
                                    )}
                                  />
                                </Card>
                                <p
                                  className={`text-xs text-muted-foreground mt-1 ${
                                    isUser ? "text-right" : "text-left"
                                  }`}
                                >
                                  {formatTime(
                                    m.metadata?.createdAt
                                      ? new Date(m.metadata.createdAt)
                                      : new Date()
                                  )}
                                </p>
                              </div>
                            );
                          }

                          if (isToolUIPart(part) && m.role === "assistant") {
                            const toolCallId = part.toolCallId;
                            //const toolName = part.type.replace("tool-", "");
                            const needsConfirmation = false;
                            return (
                              <ToolInvocationCard
                                // biome-ignore lint/suspicious/noArrayIndexKey: using index is safe here as the array is static
                                key={`${toolCallId}-${i}`}
                                toolUIPart={part}
                                toolCallId={toolCallId}
                                needsConfirmation={needsConfirmation}
                                onSubmit={({ toolCallId, result }) => {
                                  addToolResult({
                                    tool: part.type.replace("tool-", ""),
                                    toolCallId,
                                    output: result
                                  });
                                }}
                                addToolResult={(toolCallId, result) => {
                                  addToolResult({
                                    tool: part.type.replace("tool-", ""),
                                    toolCallId,
                                    output: result
                                  });
                                }}
                              />
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAgentSubmit(e, {
              annotations: {
                hello: "world"
              }
            });
            setTextareaHeight("auto"); // Reset height after submission
          }}
          className="p-3 bg-gradient-to-r from-purple-100/70 via-blue-100/80 to-indigo-100/70 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 backdrop-blur-sm absolute bottom-0 left-0 right-0 z-10 border-t border-purple-200/40 dark:border-neutral-700"
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Textarea
                disabled={pendingToolCallConfirmation}
                placeholder={
                  pendingToolCallConfirmation
                    ? "Please respond to the tool confirmation above..."
                    : "Send a message..."
                }
                className="flex w-full border border-purple-200/50 dark:border-neutral-600 bg-white/95 dark:bg-slate-800 text-slate-800 dark:text-white px-3 py-2 ring-offset-background placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 dark:focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base pb-10 backdrop-blur-sm shadow-sm"
                value={agentInput}
                onChange={(e) => {
                  handleAgentInputChange(e);
                  // Auto-resize the textarea
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  setTextareaHeight(`${e.target.scrollHeight}px`);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    handleAgentSubmit(e as unknown as React.FormEvent);
                    setTextareaHeight("auto"); // Reset height on Enter submission
                  }
                }}
                rows={2}
                style={{ height: textareaHeight }}
              />
              <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
                {status === "submitted" || status === "streaming" ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-1.5 h-fit border border-neutral-200 dark:border-neutral-800"
                    aria-label="Stop generation"
                  >
                    <Stop size={16} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-1.5 h-fit border border-neutral-200 dark:border-neutral-800"
                    disabled={pendingToolCallConfirmation || !agentInput.trim()}
                    aria-label="Send message"
                  >
                    <PaperPlaneTilt size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// const hasOpenAiKeyPromise = fetch("/check-open-ai-key").then((res) =>
//   res.json<{ success: boolean }>()
// );

// function HasOpenAIKey() {
//   const hasOpenAiKey = use(hasOpenAiKeyPromise);

//   if (!hasOpenAiKey.success) {
//     return (
//       <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/10 backdrop-blur-sm">
//         <div className="max-w-3xl mx-auto p-4">
//           <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-red-200 dark:border-red-900 p-4">
//             <div className="flex items-start gap-3">
//               <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
//                 <svg
//                   className="w-5 h-5 text-red-600 dark:text-red-400"
//                   xmlns="http://www.w3.org/2000/svg"
//                   viewBox="0 0 24 24"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   aria-labelledby="warningIcon"
//                 >
//                   <title id="warningIcon">Warning Icon</title>
//                   <circle cx="12" cy="12" r="10" />
//                   <line x1="12" y1="8" x2="12" y2="12" />
//                   <line x1="12" y1="16" x2="12.01" y2="16" />
//                 </svg>
//               </div>
//               <div className="flex-1">
//                 <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
//                   OpenAI API Key Not Configured
//                 </h3>
//                 <p className="text-neutral-600 dark:text-neutral-300 mb-1">
//                   Requests to the API, including from the frontend UI, will not
//                   work until an OpenAI API key is configured.
//                 </p>
//                 <p className="text-neutral-600 dark:text-neutral-300">
//                   Please configure an OpenAI API key by setting a{" "}
//                   <a
//                     href="https://developers.cloudflare.com/workers/configuration/secrets/"
//                     target="_blank"
//                     rel="noopener noreferrer"
//                     className="text-red-600 dark:text-red-400"
//                   >
//                     secret
//                   </a>{" "}
//                   named{" "}
//                   <code className="bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 font-mono text-sm">
//                     OPENAI_API_KEY
//                   </code>
//                   . <br />
//                   You can also use a different model provider by following these{" "}
//                   <a
//                     href="https://github.com/cloudflare/agents-starter?tab=readme-ov-file#use-a-different-ai-model-provider"
//                     target="_blank"
//                     rel="noopener noreferrer"
//                     className="text-red-600 dark:text-red-400"
//                   >
//                     instructions.
//                   </a>
//                 </p>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }
//   return null;
// }
