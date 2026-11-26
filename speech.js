let cleanup=null;
export const voices=()=>globalThis.speechSynthesis?.getVoices()||[];
export function stopSpeech(){cleanup?.();cleanup=null;globalThis.speechSynthesis?.cancel();}
export function speak(text,language,settings={}) {
  stopSpeech();
  return new Promise((resolve,reject)=>{
    if(!globalThis.speechSynthesis||!globalThis.SpeechSynthesisUtterance){reject(new Error('此浏览器没有语音能力，请切换屏幕题干模式'));return;}
    const u=new SpeechSynthesisUtterance(text);u.lang=language;u.rate=settings.rate||0.9;
    const list=voices();const preferred=language.startsWith('en')?settings.voiceEn:settings.voiceZh;
    u.voice=list.find(v=>v.voiceURI===preferred)||list.find(v=>v.lang.startsWith(language.slice(0,2))&&v.localService)||list.find(v=>v.lang.startsWith(language.slice(0,2)))||null;
    let finished=false;let timeout;
    const finish=(err)=>{if(finished)return;finished=true;clearTimeout(timeout);cleanup=null;if(err)reject(err);else resolve();};
    cleanup=()=>finish(new Error('cancelled'));
    u.onend=()=>finish();u.onerror=e=>finish(new Error(e.error==='not-allowed'?'语音未获允许，请点击继续或先试听':`语音播放失败：${e.error}`));
    timeout=setTimeout(()=>{finish(new Error('语音等待超时，请检查声音后重读，或使用屏幕题干'));globalThis.speechSynthesis.cancel();},Math.max(18000,text.length*1000));
    globalThis.speechSynthesis.speak(u);
  });
}
