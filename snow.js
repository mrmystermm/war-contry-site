(()=>{if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
const c=document.createElement('canvas');c.className='snow';document.body.appendChild(c);const x=c.getContext('2d');
let w,h,f=[];const rs=()=>{w=c.width=innerWidth;h=c.height=innerHeight};rs();addEventListener('resize',rs);
const n=innerWidth<600?35:70;for(let i=0;i<n;i++)f.push({x:Math.random()*w,y:Math.random()*h,r:Math.random()*2+.6,v:Math.random()*.7+.3,s:Math.random()*Math.PI*2});
(function a(){x.clearRect(0,0,w,h);x.fillStyle='rgba(255,255,255,.75)';for(const p of f){p.y+=p.v;p.s+=.01;p.x+=Math.sin(p.s)*.4;if(p.y>h){p.y=-5;p.x=Math.random()*w}x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fill()}requestAnimationFrame(a)})()})();
