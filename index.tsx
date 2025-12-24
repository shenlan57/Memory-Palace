
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- 1. 类型定义 (Types) ---
enum MemoryMethod {
  PALACE = 'PALACE',
  MNEMONIC = 'MNEMONIC',
  FAMILY = 'FAMILY',
  OBJECTS = 'OBJECTS'
}

interface MemoryPoint {
  content: string;
  association: string;
  visualPrompt: string;
  story: string;
}

interface MemoryPalaceResult {
  title: string;
  method: MemoryMethod;
  summary: string;
  points: MemoryPoint[];
  slogan?: string;
}

interface SavedPalace {
  id: string;
  title: string;
  createdAt: number;
  data: MemoryPalaceResult;
}

// --- 2. AI 服务逻辑 (AI Services) ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const analyzeForMemoryPalace = async (
  input: string, 
  method: MemoryMethod,
  imageData?: string
): Promise<MemoryPalaceResult> => {
  const model = "gemini-3-flash-preview";
  const methodPrompts = {
    [MemoryMethod.PALACE]: "使用传统的记忆宫殿法，将内容安置在具体的房间位置。",
    [MemoryMethod.MNEMONIC]: "创作押韵、朗朗上口的记忆口诀或顺口溜。",
    [MemoryMethod.FAMILY]: "将内容与家庭成员（如爸爸、妈妈、奶奶等）的特征或动作绑定。",
    [MemoryMethod.OBJECTS]: "将内容与日常生活中常见的物品进行联想。"
  };

  const systemInstruction = `你是一位世界顶尖的记忆专家。你的任务是帮助用户将枯燥的背诵内容转化为极易记忆的结构。
方法指导：${methodPrompts[method]}
请提取核心知识点，创造生动荒诞的视觉联想。若是口诀模式，请额外生成一段押韵口诀。`;

  const contents: any[] = [{ text: input || "请分析这张图中的文字内容并进行记忆编码。" }];
  if (imageData) {
    contents.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageData.split(',')[1]
      }
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts: contents },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          method: { type: Type.STRING },
          summary: { type: Type.STRING },
          slogan: { type: Type.STRING },
          points: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                content: { type: Type.STRING },
                association: { type: Type.STRING },
                visualPrompt: { type: Type.STRING },
                story: { type: Type.STRING }
              },
              required: ["content", "association", "visualPrompt", "story"]
            }
          }
        },
        required: ["title", "method", "summary", "points"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

const generateMnemonicImage = async (prompt: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `A surreal, vivid, and helpful mnemonic memory aid illustration: ${prompt}` }]
    },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Failed to generate image");
};

// --- 3. 子组件 (Sub-components) ---
const MemoryCard: React.FC<{ point: MemoryPoint; index: number }> = ({ point, index }) => {
  const [aiImage, setAiImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerateImage = async () => {
    setLoading(true);
    try {
      const img = await generateMnemonicImage(point.visualPrompt);
      setAiImage(img);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base md:text-lg flex-shrink-0">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">知识点</h4>
            <p className="text-slate-800 font-semibold leading-relaxed mb-4 break-words">{point.content}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <h5 className="text-amber-800 text-xs font-bold mb-1 flex items-center gap-1">📍 记忆点: {point.association}</h5>
                <p className="text-amber-900 text-sm leading-relaxed">{point.story}</p>
              </div>
              <div className="bg-sky-50 rounded-xl p-4 border border-sky-100">
                <h5 className="text-sky-800 text-xs font-bold mb-1">👁️ 脑海画面</h5>
                <p className="text-sky-900 text-sm italic">{point.visualPrompt}</p>
                <button 
                  onClick={handleGenerateImage}
                  disabled={loading}
                  className="mt-3 text-[10px] bg-sky-600 text-white px-3 py-1 rounded-full hover:bg-sky-700 disabled:opacity-50"
                >
                  {loading ? '生成中...' : aiImage ? '重生成画面' : 'AI 辅助生成画面'}
                </button>
              </div>
            </div>
            {aiImage && <img src={aiImage} alt="Visual aid" className="mt-4 rounded-xl border border-slate-200 w-full object-cover max-h-60" />}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 4. 主应用组件 (Main App) ---
const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<MemoryMethod>(MemoryMethod.PALACE);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MemoryPalaceResult | null>(null);
  const [savedPalaces, setSavedPalaces] = useState<SavedPalace[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('saved_palaces');
    if (stored) setSavedPalaces(JSON.parse(stored));
  }, []);

  const handleProcess = async () => {
    if (!inputText && !capturedImage) return;
    setIsLoading(true);
    try {
      const data = await analyzeForMemoryPalace(inputText, selectedMethod, capturedImage || undefined);
      setResult(data);
      const newPalace: SavedPalace = { id: Date.now().toString(), title: data.title, createdAt: Date.now(), data };
      const updated = [newPalace, ...savedPalaces];
      setSavedPalaces(updated);
      localStorage.setItem('saved_palaces', JSON.stringify(updated));
    } catch (err) {
      alert("AI 思考过度，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = () => {
    if (!result) return;
    const text = `🧠 【MindPalace 记忆宫殿】\n\n主题：${result.title}\n记忆法：${result.method}\n\n${result.slogan ? `🎵 口诀：${result.slogan}\n\n` : ''}${result.points.map((p, i) => `${i+1}. [${p.content}]\n   📍 关联：${p.association}\n   📖 故事：${p.story}`).join('\n\n')}\n\n--- 轻松复诵，持久记忆 ---`;
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-[#FDFDFF] text-slate-900 pb-24">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-xl rotate-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          </div>
          <span className="font-black text-xl tracking-tighter text-indigo-900">MindPalace</span>
        </div>
        <button onClick={() => setShowSaved(!showSaved)} className="text-indigo-600 font-bold text-sm bg-indigo-50 px-4 py-2 rounded-full hover:bg-indigo-100 transition-colors">
          {showSaved ? '返回' : `记忆馆 (${savedPalaces.length})`}
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {showSaved ? (
          <div className="animate-in fade-in duration-500">
            <h2 className="text-3xl font-black text-slate-900 mb-8">我的记忆馆</h2>
            <div className="grid gap-4">
              {savedPalaces.map(p => (
                <div key={p.id} onClick={() => {setResult(p.data); setShowSaved(false)}} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md cursor-pointer transition-all">
                  <h3 className="font-bold text-lg mb-1">{p.title}</h3>
                  <p className="text-slate-400 text-xs">{new Date(p.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {savedPalaces.length === 0 && <p className="text-center text-slate-400 py-20">这里空空的，快去背点什么吧</p>}
            </div>
          </div>
        ) : !result ? (
          <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-4">
              <h2 className="text-4xl font-black text-slate-900 leading-tight">让记忆变得<br/><span className="text-indigo-600">触手可及。</span></h2>
              <div className="relative group">
                <textarea 
                  value={inputText} 
                  onChange={e => setInputText(e.target.value)}
                  placeholder="在这里粘贴你背不下来的枯燥文字..."
                  className="w-full h-56 p-6 bg-white border-2 border-slate-100 rounded-[2rem] shadow-xl shadow-slate-100 focus:border-indigo-500 outline-none transition-all text-lg leading-relaxed resize-none"
                />
                <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-4 right-4 p-3 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-2xl transition-all">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <input type="file" ref={fileInputRef} onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const r = new FileReader();
                      r.onloadend = () => setCapturedImage(r.result as string);
                      r.readAsDataURL(f);
                    }
                  }} className="hidden" accept="image/*" capture="environment" />
                </button>
              </div>
              {capturedImage && (
                <div className="flex items-center gap-3 bg-indigo-50 p-3 rounded-2xl animate-in zoom-in-95">
                  <img src={capturedImage} className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-sm" />
                  <div className="flex-1 text-sm text-indigo-900 font-bold">图片已就绪</div>
                  <button onClick={() => setCapturedImage(null)} className="p-2 text-indigo-400 hover:text-red-500">移除</button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { id: MemoryMethod.PALACE, label: '宫殿', icon: '🏰' },
                { id: MemoryMethod.MNEMONIC, label: '口诀', icon: '🎵' },
                { id: MemoryMethod.FAMILY, label: '亲情', icon: '❤️' },
                { id: MemoryMethod.OBJECTS, label: '物品', icon: '📱' },
              ].map(m => (
                <button key={m.id} onClick={() => setSelectedMethod(m.id)} className={`p-4 rounded-2xl border-2 transition-all text-center ${selectedMethod === m.id ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-50 bg-white'}`}>
                  <div className="text-2xl mb-1">{m.icon}</div>
                  <div className={`font-bold text-sm ${selectedMethod === m.id ? 'text-indigo-600' : 'text-slate-400'}`}>{m.label}</div>
                </button>
              ))}
            </div>

            <button onClick={handleProcess} disabled={isLoading || (!inputText && !capturedImage)} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl rounded-[2rem] shadow-2xl shadow-indigo-200 transition-all disabled:opacity-50 active:scale-95">
              {isLoading ? '正在进行记忆编码...' : '一键开启记忆宫殿'}
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
            <div className="flex justify-between items-center">
              <button onClick={() => {setResult(null); setInputText(''); setCapturedImage(null)}} className="text-slate-400 font-bold flex items-center gap-1">← 重写内容</button>
              <button onClick={handleShare} className={`px-6 py-2 rounded-full font-bold transition-all ${copyFeedback ? 'bg-green-100 text-green-700' : 'bg-indigo-600 text-white'}`}>
                {copyFeedback ? '文案已复制' : '分享记忆法'}
              </button>
            </div>

            <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
              <h2 className="text-3xl font-black mb-4 leading-tight">{result.title}</h2>
              <p className="text-slate-500 mb-10 leading-relaxed">{result.summary}</p>

              {result.slogan && (
                <div className="bg-slate-50 p-8 rounded-[2rem] mb-12 border-2 border-dashed border-slate-200">
                  <p className="text-indigo-600 font-black text-2xl text-center leading-loose">{result.slogan}</p>
                </div>
              )}

              <div className="space-y-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px bg-slate-100 flex-1"></div>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">记忆路线图</span>
                  <div className="h-px bg-slate-100 flex-1"></div>
                </div>
                {result.points.map((p, i) => <MemoryCard key={i} point={p} index={i} />)}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// --- 5. 渲染入口 (Entry) ---
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<React.StrictMode><App /></React.StrictMode>);
}
