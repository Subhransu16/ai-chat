import { useState, useEffect, useRef } from "react";
import "./App.css";
import { generateContent } from "./index.js";
console.log("Gemini Key:", import.meta.env.VITE_GEMINI_KEY);
console.log("Weather Key:", import.meta.env.VITE_OPENWEATHER_KEY);
console.log("News Key:", import.meta.env.VITE_NEWS_KEY);

const synth = window.speechSynthesis;
let selectedVoice = null;

// 🆕 Cute Live Clock Component
const LiveClock = ({ time, darkMode }) => (
  <div
    style={{
      background: darkMode ? "#282c34" : "#ffeff5",
      color: darkMode ? "#ffb3d9" : "#e91e63",
      padding: "4px 10px",
      borderRadius: "20px",
      fontWeight: "bold",
      fontSize: "0.9rem",
      boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
      marginLeft: "10px",
    }}
  >
    {time.toLocaleTimeString()}
  </div>
);

const App = () => {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("chatHistory");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      console.warn("Cleared old invalid chat history");
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [clock, setClock] = useState(new Date());
  const messagesEndRef = useRef(null);

  // 🕒 Live Clock
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 🎙 Load voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = synth.getVoices();
      selectedVoice =
        voices.find((v) => v.name.toLowerCase().includes("female")) ||
        voices.find((v) => v.name.toLowerCase().includes("google uk english female")) ||
        voices.find((v) => v.name.toLowerCase().includes("google us english")) ||
        voices[0];
    };
    loadVoices();
    synth.onvoiceschanged = loadVoices;
  }, []);

  // 🖱 Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    localStorage.setItem("chatHistory", JSON.stringify(messages));
  }, [messages]);

  const speak = (text) => {
    if (!text || !synth) return;
    const utter = new SpeechSynthesisUtterance(text);
    if (selectedVoice) utter.voice = selectedVoice;
    utter.pitch = 1.3;
    utter.rate = 1.05;
    synth.cancel();
    synth.speak(utter);
  };

  const stopSpeaking = () => {
    synth.cancel();
  };

  const addMessage = (data, type = "text", isUser = false, speakText = true) => {
    const msg = { type, isUser };
    if (type === "text" || type === "error") {
      msg.content = typeof data === "string" ? data : JSON.stringify(data);
    } else if (type === "weather") {
      msg.content = data;
    } else if (type === "news") {
      msg.content = {
        countryCode: data.countryCode,
        articles: data.articles.map((a) => ({
          title: a.title,
          description: a.description,
          url: a.url,
          urlToImage: a.urlToImage,
        })),
      };
    }
    setMessages((prev) => [...prev, msg]);
    if (!isUser && speakText && type === "text") speak(msg.content);
  };

  // 🌦 Weather
  const fetchWeather = async (city) => {
    try {
      let cityQuery = city.trim();
      if (!cityQuery.includes(",")) cityQuery += ",IN";

      const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        cityQuery
      )}&appid=${import.meta.env.VITE_OPENWEATHER_KEY}&units=metric`;

      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.cod !== 200) throw new Error(data.message);

      addMessage(data, "weather");
    } catch (err) {
      addMessage(`Weather Error: ${err.message}`, "error");
    }
  };

  // 📰 News
  const fetchNews = async (userQuery) => {
    try {
      const countryMap = {
        india: "in",
        usa: "us",
        america: "us",
        uk: "gb",
        britain: "gb",
        canada: "ca",
        australia: "au",
        germany: "de",
        france: "fr",
        japan: "jp",
      };

      let countryCode = "";
      let keyword = "";

      const matchCountry = userQuery.match(/news in ([a-zA-Z]+)/);
      if (matchCountry) {
        countryCode = countryMap[matchCountry[1].toLowerCase()] || "";
      }

      const matchTopic = userQuery.match(/news about (.+)/);
      if (matchTopic) {
        keyword = matchTopic[1].trim();
      }

      const url = keyword
        ? `https://newsapi.org/v2/everything?q=${encodeURIComponent(
            keyword
          )}&pageSize=5&language=en&sortBy=publishedAt&apiKey=${
            import.meta.env.VITE_NEWS_KEY
          }`
        : `https://newsapi.org/v2/top-headlines?${
            countryCode ? `country=${countryCode}&` : ""
          }pageSize=5&language=en&apiKey=${import.meta.env.VITE_NEWS_KEY}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.articles || data.articles.length === 0) {
        addMessage("No news found. Try 'news about technology' or 'news in india'.", "text");
        return;
      }

      addMessage({ countryCode: countryCode || "global", articles: data.articles }, "news");
    } catch (err) {
      addMessage(`Error loading news: ${err.message}`, "error");
    }
  };

  // 😂 Jokes
  const fetchJoke = async () => {
    try {
      const res = await fetch(`https://v2.jokeapi.dev/joke/Any?type=single`);
      const data = await res.json();
      if (data?.joke) {
        addMessage(`😂 ${data.joke}`, "text");
      } else {
        addMessage("Couldn't find a joke right now. Try again!", "text");
      }
    } catch (err) {
      addMessage(`Joke Error: ${err.message}`, "error");
    }
  };

  // 🧠 Main Query Handler
  const handleQuery = async (text = query) => {
    if (!text.trim()) return;
    addMessage(text, "text", true, false);
    setQuery("");
    setLoading(true);

    try {
      const lower = text.toLowerCase();
      if (lower.includes("weather")) {
        addMessage("Fetching weather...", "text");
        let city = lower.replace("weather in", "").replace("weather", "").trim();
        if (!city) city = "Delhi";
        await fetchWeather(city);
      } else if (lower.includes("news")) {
        addMessage("Fetching news...", "text");
        await fetchNews(lower);
      } else if (lower.includes("joke")) {
        addMessage("Fetching a joke for you...", "text");
        await fetchJoke();
      } else if (lower.includes("clock")) {
        addMessage(new Date().toLocaleTimeString(), "text");
      } else {
        const aiResponse = await generateContent(text);
        let safeResponse =
          typeof aiResponse === "string"
            ? aiResponse
            : aiResponse?.content || JSON.stringify(aiResponse);
        addMessage(safeResponse, "text");
      }
    } catch {
      addMessage("⚠️ Something went wrong.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = () => {
    if (!window.webkitSpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleQuery(transcript);
    };
  };

  return (
    <div
      className="app-container"
      style={{
        "--bg-color": darkMode ? "#181818" : "#f2f4f7",
        "--card-bg": darkMode ? "#242424" : "#fff",
        "--bubble-bg": darkMode ? "#2f2f2f" : "#f1f3f5",
      }}
    >
      {/* Header */}
      <div className="chat-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <img src="https://i.pravatar.cc/36" alt="Avatar" />
          <div>
            <h3>Chat with Assistant</h3>
            <span>Always here to help</span>
          </div>
          <LiveClock time={clock} darkMode={darkMode} />
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            className="clear-btn"
            onClick={() => {
              localStorage.removeItem("chatHistory");
              setMessages([]);
            }}
          >
            🗑 Clear
          </button>
          <button className="theme-toggle" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="output-box">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.isUser ? "user" : ""}`}>
            {msg.type === "weather" ? (
              <div className="weather-card">
                <h3>
                  {msg.content.name}, {msg.content.sys.country}
                </h3>
                <h2>{Math.round(msg.content.main.temp)}°C</h2>
                <p>{msg.content.weather[0].description}</p>
                <p>
                  Min: {Math.round(msg.content.main.temp_min)}° | Max:{" "}
                  {Math.round(msg.content.main.temp_max)}°
                </p>
                <p>💧 {msg.content.main.humidity}% | 🌬 {msg.content.wind.speed} m/s</p>
              </div>
            ) : msg.type === "news" ? (
              <div className="news-container">
                <h3>📰 Top Headlines ({msg.content.countryCode.toUpperCase()})</h3>
                {msg.content.articles.map((article, idx) => (
                  <div key={idx} className="news-card">
                    {article.urlToImage && <img src={article.urlToImage} alt="news" />}
                    <div>
                      <strong>{article.title}</strong>
                      <p>{article.description || "No description available."}</p>
                      {article.url && (
                        <a href={article.url} target="_blank" rel="noopener noreferrer">
                          Read more →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : msg.type === "error" ? (
              <p style={{ color: "red" }}>{String(msg.content)}</p>
            ) : (
              String(msg.content)
            )}
          </div>
        ))}
        {loading && <div className="typing-indicator">Assistant is typing...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Buttons */}
      <div className="quick-buttons">
        <button onClick={() => handleQuery("Weather in Delhi")}>🌦 Weather</button>
        <button onClick={() => handleQuery("news")}>📰 News</button>
        <button onClick={() => handleQuery("tell me a joke")}>😂 Joke</button>
        <button onClick={() => handleQuery("Show me digital clock")}>🕒 Clock</button>
      </div>

      {/* Chat Input */}
      <div className="chat-input">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a message..."
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleQuery(query);
            }
          }}
        />
        <button onClick={() => handleQuery(query)}>➤</button>
        <button onClick={handleVoiceInput}>🎤</button>
        <button onClick={stopSpeaking}>🔇</button>
      </div>
    </div>
  );
};

export default App;
