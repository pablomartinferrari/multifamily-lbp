import * as React from "react";
import {
  Panel,
  PanelType,
  TextField,
  PrimaryButton,
  Stack,
  Text,
  Spinner,
  SpinnerSize,
  IconButton,
  Icon,
  mergeStyleSets,
  MessageBar,
  MessageBarType,
  IRenderFunction,
  IPanelProps,
} from "@fluentui/react";
import { getOpenAIService } from "../../services/OpenAIService";
import { HELP_SYSTEM_PROMPT } from "../../config/HelpContext";

const styles = mergeStyleSets({
  panel: {
    // Panel content: no padding, flex column, take full height
    ".ms-Panel-content": {
      padding: "0",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      minHeight: 0,
      overflow: "hidden",
    },
    // Stop the panel from scrolling; only our messages area should scroll
    ".ms-Panel-scrollableContent": {
      flex: "1 1 0",
      minHeight: 0,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    },
    ".ms-Panel-scrollableContent > div": {
      display: "flex",
      flexDirection: "column",
      flex: "1 1 0",
      minHeight: 0,
      overflow: "hidden",
    },
  },
  chatContainer: {
    display: "flex",
    flexDirection: "column",
    flex: "1 1 0",
    minHeight: 0,
    maxHeight: "80vh",
    overflow: "hidden",
  },
  messagesContainer: {
    flex: "1 1 0",
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  errorBar: {
    flexShrink: 0,
  },
  inputContainer: {
    flexShrink: 0,
    padding: "16px",
    borderTop: "1px solid #edebe9",
    backgroundColor: "#faf9f8",
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#0078d4",
    color: "white",
    padding: "10px 14px",
    borderRadius: "12px 12px 4px 12px",
    maxWidth: "80%",
    wordBreak: "break-word",
  },
  assistantMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#f3f2f1",
    color: "#323130",
    padding: "10px 14px",
    borderRadius: "12px 12px 12px 4px",
    maxWidth: "80%",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  welcomeMessage: {
    textAlign: "center",
    color: "#605e5c",
    padding: "20px",
  },
  suggestionChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    justifyContent: "center",
    marginTop: "16px",
  },
  suggestionChip: {
    padding: "8px 12px",
    backgroundColor: "#e1dfdd",
    borderRadius: "16px",
    cursor: "pointer",
    fontSize: "12px",
    border: "none",
    ":hover": {
      backgroundColor: "#d2d0ce",
    },
  },
  loadingContainer: {
    alignSelf: "flex-start",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    backgroundColor: "#f3f2f1",
    borderRadius: "12px 12px 12px 4px",
  },
});

interface IChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface IHelpChatPanelProps {
  isOpen: boolean;
  onDismiss: () => void;
}

const SUGGESTION_QUESTIONS = [
  "How do I upload a file?",
  "What is component normalization?",
  "How are readings classified?",
  "What does the 2.5% threshold mean?",
  "How do I merge data?",
];

// Custom header with AI indicator
const onRenderHeader: IRenderFunction<IPanelProps> = (props, defaultRender) => {
  return (
    <Stack
      horizontal
      verticalAlign="center"
      tokens={{ childrenGap: 8 }}
      styles={{
        root: {
          padding: "16px 24px",
          borderBottom: "1px solid #edebe9",
        },
      }}
    >
      <Icon
        iconName="Robot"
        styles={{
          root: {
            fontSize: 20,
            color: "#8764b8",
          },
        }}
      />
      <Text variant="xLarge" styles={{ root: { fontWeight: 600 } }}>
        AI Help Assistant
      </Text>
      <Text
        variant="small"
        styles={{
          root: {
            backgroundColor: "#e8def8",
            color: "#6750a4",
            padding: "2px 8px",
            borderRadius: "12px",
            fontWeight: 500,
          },
        }}
      >
        Powered by AI
      </Text>
    </Stack>
  );
};

export const HelpChatPanel: React.FC<IHelpChatPanelProps> = ({
  isOpen,
  onDismiss,
}) => {
  const [messages, setMessages] = React.useState<IChatMessage[]>([]);
  const [inputValue, setInputValue] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (question?: string): Promise<void> => {
    const messageToSend = question || inputValue.trim();
    if (!messageToSend || isLoading) return;

    setError(null);
    setInputValue("");

    // Add user message
    const userMessage: IChatMessage = { role: "user", content: messageToSend };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const openAIService = getOpenAIService();
      
      if (!openAIService.isConfigured()) {
        throw new Error("OpenAI is not configured. Please configure your API key in the web part settings.");
      }

      const response = await openAIService.chat(HELP_SYSTEM_PROMPT, messageToSend);
      
      const assistantMessage: IChatMessage = { role: "assistant", content: response };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Help chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend().catch(console.error);
    }
  };

  const handleClear = (): void => {
    setMessages([]);
    setError(null);
  };

  return (
    <Panel
      isOpen={isOpen}
      onDismiss={onDismiss}
      type={PanelType.medium}
      className={styles.panel}
      isLightDismiss
      onRenderHeader={onRenderHeader}
      onRenderFooterContent={() => null}
    >
      <div className={styles.chatContainer}>
        <div className={styles.messagesContainer}>
          {messages.length === 0 ? (
            <div className={styles.welcomeMessage}>
              <Text variant="large" block style={{ marginBottom: 8 }}>
                ✨ Hi! I&apos;m your AI-powered assistant.
              </Text>
              <Text block>
                Ask me anything about how to use the XRF Processor.
              </Text>
              <div className={styles.suggestionChips}>
                {SUGGESTION_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    className={styles.suggestionChip}
                    onClick={() => handleSend(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={
                    msg.role === "user"
                      ? styles.userMessage
                      : styles.assistantMessage
                  }
                >
                  {msg.content}
                </div>
              ))}
              {isLoading && (
                <div className={styles.loadingContainer}>
                  <Spinner size={SpinnerSize.small} />
                  <Text>Thinking...</Text>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className={styles.errorBar}>
            <MessageBar
              messageBarType={MessageBarType.error}
              onDismiss={() => setError(null)}
              dismissButtonAriaLabel="Close"
            >
              {error}
            </MessageBar>
          </div>
        )}

        <div className={styles.inputContainer}>
          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <Stack.Item grow>
              <TextField
                placeholder="Ask a question..."
                value={inputValue}
                onChange={(_, val) => setInputValue(val || "")}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                multiline
                rows={2}
                resizable={false}
              />
            </Stack.Item>
            <Stack tokens={{ childrenGap: 4 }}>
              <PrimaryButton
                text="Send"
                onClick={() => handleSend()}
                disabled={!inputValue.trim() || isLoading}
                iconProps={{ iconName: "Send" }}
              />
              <IconButton
                iconProps={{ iconName: "Delete" }}
                title="Clear chat"
                ariaLabel="Clear chat"
                onClick={handleClear}
                disabled={messages.length === 0}
              />
            </Stack>
          </Stack>
        </div>
      </div>
    </Panel>
  );
};

export default HelpChatPanel;
