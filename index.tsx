
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// 兼容性处理：防止浏览器因找不到 process 对象而报错
if (typeof window !== 'undefined' && !window.process) {
  window.process = { env: { API_KEY: "" } };
}

// --- 类型定义 ---
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

// --- AI 服务 ---
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const analyzeForMemoryPalace = async (input: string, method: MemoryMethod, imageData?: string): Promise<MemoryPalaceResult> => {
  const ai = getAiClient();
  const methodPrompts = {
    [MemoryMethod.PALACE]: "使用传统的记忆宫殿法，将内容安置在具体的房间位置。",
    [MemoryMethod.MNEMONIC]: "创作押韵、朗朗上口的记忆口诀或顺口溜。",
    [MemoryMethod.FAMILY]: "将内容与家庭成员的特征或动作绑定。",
    [MemoryMethod.OBJECTS]: "将内容与日常生活中的常见物品（如手机、杯子）进行联想。"
  };

  const systemInstruction = `你是一位世界顶尖的记忆专家。将内容转化为极易记忆的结构。要求：提取核心知识点，创造生动荒诞的联想，若是口诀模式请额外生成押韵口诀。`;
  const contents: any[] = [{ text: input || "请分析内容并进行记忆编码。" }];
  if (imageData) {
    contents.push({ inlineData: { mimeType: "image/jpeg", data: imageData.split(',')[1] } });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `A vibrant mnemonic aid illustration: ${prompt}` }] },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Img fail");
};

// --- 子组件 ---
const MemoryCard: React.FC<{ point: MemoryPoint; index: number }> = ({ point, index }) => {
  const [img, setImg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImg = async () => {
    setLoading(true);
    try { setImg(await generateMnemonicImage(point.visualPrompt)); } catch (e) {} finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-3xl p-5 mb-4 border border-slate-100 shadow-sm">
      <div className="flex gap-4">
        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">{index + 1}</div>
        <div className="flex-1">
          <p className="font-bold text-slate-800 mb-3">{point.content}</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-amber-50 p-3 rounded-2xl text-xs"><b className="text-amber-800 block mb-1">📍 记忆锚点: {point.association}</b>{point.story}</div>
            <div className="bg-sky-50 p-3 rounded-2xl text-xs">
              <b className="text-sky-800 block mb-1">👁️ 视觉联想</b>{point.visualPrompt}
              <button onClick={handleImg} disabled={loading} className="mt-2 text-[10px] text-sky-600 underline">
                {loading ? 'AI绘图中...' : img ? '重绘' : '生成画面助手'}
              </button>
            </div>
          </div>
          {img && <img src={img} className="mt-3 rounded-xl w-full max-h-48 object-cover border" />}
        </div>
      </div>
    </div>
  );
};

// --- 主应用 ---
const App: React.FC = () => {
  const [text, setText] = useState('');
  const [method, setMethod] = useState(MemoryMethod.PALACE);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<MemoryPalaceResult | null>(null);
  const [imgData, setImgData] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const start = async () => {
    setLoading(true);
    try { setRes(await analyzeForMemoryPalace(text, method, imgData || undefined)); } 
    catch (e) { alert("生成失败，请检查网络或重试"); } 
    finally { setLoading(false); }
  };

  const share = () => {
    if (!res) return;
    const shareT = `【MindPalace 记忆方案】\n主题：${res.title}\n${res.slogan ? `口诀：${res.slogan}\n` : ''}${res.points.map((p,i)=>`${i+1}.${p.content} (记:${p.association})`).join('\n')}`;
    navigator.clipboard.writeText(shareT).then(() => { setCopied(true); setTimeout(()=>setCopied(false), 2000); });
  };

  return (
    <div className="max-w-2xl mx-auto px-5 py-10 min-h-screen">
      <div className="flex items-center gap-2 mb-10">
        <div className="bg-indigo-600 p-2 rounded-lg text-white font-black">M</div>
        <h1 className="text-xl font-black tracking-tight">MindPalace AI</h1>
      </div>

      {!res ? (
        <div className="animate-fade-in space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-black">把背不下来的内容<br/><span className="text-indigo-600">交给 AI 编码。</span></h2>
            <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="输入或粘贴内容..." className="w-full h-48 p-5 rounded-[2rem] border-2 border-slate-100 bg-white focus:border-indigo-500 outline-none text-lg" />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { id: MemoryMethod.PALACE, n: '🏰 宫殿' },
              { id: MemoryMethod.MNEMONIC, n: '🎵 口诀' },
              { id: MemoryMethod.FAMILY, n: '❤️ 亲情' },
              { id: MemoryMethod.OBJECTS, n: '📱 物品' }
            ].map(m => (
              <button key={m.id} onClick={()=>setMethod(m.id)} className={`px-5 py-3 rounded-full font-bold text-sm flex-shrink-0 transition-all ${method === m.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{m.n}</button>
            ))}
          </div>

          <div className="flex gap-3">
             <button onClick={()=>fileRef.current?.click()} className="flex-1 py-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-500 hover:bg-slate-50">
               {imgData ? '📸 已选图片' : '📸 上传图片'}
               <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={e=>{
                 const f = e.target.files?.[0]; if(f){const r=new FileReader(); r.onloadend=()=>setImgData(r.result as string); r.readAsDataURL(f);}
               }} />
             </button>
             <button onClick={start} disabled={loading || (!text && !imgData)} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 disabled:opacity-50">
               {loading ? '记忆专家编码中...' : '生成记忆方案'}
             </button>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in space-y-6">
          <div className="flex justify-between items-center">
            <button onClick={()=>{setRes(null); setImgData(null);}} className="text-slate-400 font-bold">← 返回修改</button>
            <button onClick={share} className={`px-6 py-2 rounded-full font-bold text-sm ${copied ? 'bg-green-100 text-green-700' : 'bg-indigo-600 text-white'}`}>
              {copied ? '文案已复制' : '复制分享给朋友'}
            </button>
          </div>

          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <h2 className="text-2xl font-black mb-2">{res.title}</h2>
            <p className="text-slate-500 text-sm mb-8">{res.summary}</p>
            {res.slogan && <div className="bg-indigo-50 p-6 rounded-2xl text-center mb-8"><p className="text-indigo-600 font-black text-xl italic">{res.slogan}</p></div>}
            <div className="space-y-4">
              {res.points.map((p, i) => <MemoryCard key={i} point={p} index={i} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 渲染
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
