import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// Helper to format inline bold (**text**) and code (`code`)
const formatInlineText = (str) => {
  if (!str) return '';
  const parts = str.split('**');
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index} className="font-bold text-[#1e3a5f] [#bfdbfe]">{part}</strong>;
    }
    
    // Check for inline code
    const subParts = part.split('`');
    return subParts.map((sub, subIndex) => {
      if (subIndex % 2 === 1) {
        return (
          <code key={subIndex} className="bg-purple-100  border border-purple-200  px-1 py-0.5 rounded font-mono text-xs text-purple-700 ">
            {sub}
          </code>
        );
      }
      return sub;
    });
  });
};

// Rich Message Content Renderer (converts paragraphs, headers, lists, code blocks)
const renderMessageContent = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  let inCodeBlock = false;
  let codeLines = [];

  return lines.map((line, i) => {
    // Handle code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        inCodeBlock = false;
        const code = codeLines.join('\n');
        codeLines = [];
        return (
          <pre key={i} className="bg-gray-900 text-gray-100 p-3 rounded-lg font-mono text-xs overflow-x-auto my-2 border border-gray-800">
            <code>{code}</code>
          </pre>
        );
      } else {
        inCodeBlock = true;
        return null;
      }
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return null;
    }

    // Handle Headers
    if (line.startsWith('### ')) {
      return <h4 key={i} className="text-sm font-extrabold mt-3 mb-1 text-purple-950 ">{line.replace('### ', '')}</h4>;
    }
    if (line.startsWith('## ')) {
      return <h3 key={i} className="text-base font-extrabold mt-4 mb-1 text-purple-950 ">{line.replace('## ', '')}</h3>;
    }
    if (line.startsWith('# ')) {
      return <h2 key={i} className="text-lg font-extrabold mt-4 mb-2 text-purple-950 ">{line.replace('# ', '')}</h2>;
    }

    // Handle Lists
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const content = line.trim().substring(2);
      return (
        <li key={i} className="ml-4 list-disc text-sm my-1 text-gray-800 ">
          {formatInlineText(content)}
        </li>
      );
    }

    // Handle blank lines
    if (line.trim() === '') {
      return <div key={i} className="h-2" />;
    }

    // Standard paragraph
    return (
      <p key={i} className="text-sm my-1 leading-relaxed text-gray-800 ">
        {formatInlineText(line)}
      </p>
    );
  });
};

export default function Chat() {
  const { user, isLead } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello ${user?.name}! I am **Gitora AI**, your intelligent issue manager assistant.

I have synchronized all current issues. Here is what I can help you with:
${
  isLead
    ? `- **Stats Summary**: Ask me things like "how many issues closed this week", "who resolved the most", or "which team has most open open issues"
- **Technical Guidance**: Query issue descriptions or suggest immediate resolutions for critical bugs`
    : `- **My Issues Focus**: Ask me about your assigned bugs and issues
- **Next Steps & Code Fixes**: Ask me to suggest debug steps or explain triage tags on your tickets`
}

Click the quick button below or type a query to get started!`,
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || input.trim();
    if (!query) return;

    if (!textToSend) setInput('');

    // Add User Message
    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      // 1. Fetch all issues from GET /api/issues
      const issuesRes = await api.get('/issues/');
      const issuesList = issuesRes.data.results || issuesRes.data.issues || issuesRes.data || [];

      // Optimize the issue list to stay safely within Groq token limits and prevent 429 errors
      const optimizedIssues = issuesList.map(i => ({
        number: i.issueId,
        title: i.title,
        status: i.status,
        workflowStatus: i.workflowStatus,
        priority: i.priority,
        severity: i.severity,
        assignee: i.assignee?.name || 'Unassigned',
        explanation: i.aiExplanation || ''
      }));

      // 2. Format the custom system prompt with issue JSON context
      const systemPrompt = `You are an AI assistant for Gitora, an engineering issue tracker. 
Here are the current issues for this team member:
${JSON.stringify(optimizedIssues)}

Use this data to answer questions about specific issues by number, 
explain what the issue is, suggest how to fix it, and give status updates.
Always answer based on the actual issue data provided.`;

      // Build simple context history (excluding welcome message to stay light)
      const chatHistory = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      // 3. Post to backend with system_prompt
      const { data } = await api.post('/issues/chat', {
        message: query,
        history: chatHistory,
        system_prompt: systemPrompt,
      });

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      toast.error('AI assistant failed to respond. Please try again.');
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '⚠️ *I am sorry, but I had trouble processing that request. Please verify that your Groq API Key is valid and try again.*',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleQuickAction = (type) => {
    if (sending) return;
    
    let text = '';
    if (type === 'my_issues') {
      text = 'What are my assigned issues and what should I focus on first?';
    } else if (type === 'stats') {
      text = 'Give me a brief summary of how many issues were resolved this week, who resolved the most, and which team has the most open issues.';
    } else if (type === 'leader') {
      text = 'Who resolved the most issues overall? Give me a quick leaderboards review.';
    }
    
    handleSendMessage(text);
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)] p-4 md:p-6">
      
      {/* Header */}
      <div className="card p-4 flex items-center justify-between mb-4 border-[#d1dce8]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-[#4361ee] flex items-center justify-center">
            <Bot size={22} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-[#1e3a5f] flex items-center gap-1.5">
              Gitora AI Assistant
              <span className="badge bg-purple-100 text-purple-700 text-[10px] font-bold">
                Llama 3.3
              </span>
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Synchronized with the active issue tracker context
            </p>
          </div>
        </div>
        
        <button
          onClick={() => {
            if (window.confirm('Reset conversation?')) {
              setMessages([messages[0]]);
            }
          }}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          title="Reset Conversation"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Chat messages pane */}
      <div className="flex-1 card p-4 overflow-y-auto space-y-4 mb-4 border-[#d1dce8] bg-[#f8fafc]">
        {messages.map((msg) => {
          const isAI = msg.role === 'assistant';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${isAI ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                isAI ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {isAI ? <Bot size={16} /> : <User size={16} />}
              </div>

              {/* Message Bubble */}
              <div className={`p-4 rounded-2xl shadow-sm border ${
                isAI 
                  ? 'bg-white border-purple-100 text-gray-800 rounded-tl-none' 
                  : 'bg-[#4361ee] border-[#4361ee] text-primary rounded-tr-none'
              }`}>
                {isAI ? (
                  <div className="space-y-1">{renderMessageContent(msg.content)}</div>
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {sending && (
          <div className="flex gap-3 max-w-[85%] mr-auto">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="p-4 bg-white border border-purple-100 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Action presets */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => handleQuickAction('my_issues')}
          disabled={sending}
          className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
        >
          <Sparkles size={12} />
          Ask about my issues
        </button>
        {isLead && (
          <>
            <button
              onClick={() => handleQuickAction('stats')}
              disabled={sending}
              className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <Sparkles size={12} />
              Give me a stats summary
            </button>
            <button
              onClick={() => handleQuickAction('leader')}
              disabled={sending}
              className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <Sparkles size={12} />
              Who resolved the most issues?
            </button>
          </>
        )}
      </div>

      {/* Input section */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex gap-2 shrink-0"
      >
        <input
          type="text"
          className="input flex-1 py-3 px-4 border-[#d1dce8]"
          placeholder="Ask anything about the engineering issues..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="btn-primary px-5 font-bold flex items-center justify-center shrink-0"
        >
          <Send size={16} />
        </button>
      </form>
      
    </div>
  );
}
