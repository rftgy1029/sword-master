// DOM card backs keep the actual accessible hand in React and avoid a second engine.
export function startCardDealScene(parent) {
  let disposed=false;
  const flights=new Set();
  let width=parent.clientWidth,height=parent.clientHeight;
  const finish=()=>{for(const flight of [...flights])flight.finish();};
  const observer=new ResizeObserver(()=>{
    if(Math.abs(parent.clientWidth-width)>.5||Math.abs(parent.clientHeight-height)>.5){
      width=parent.clientWidth;height=parent.clientHeight;finish();
    }
  });
  observer.observe(parent);
  return {
    async play({cards,targets,source,reshuffle=false,onArrive=()=>{}}){
      if(disposed)return;
      finish();
      await Promise.all(cards.map((card,index)=>new Promise(resolve=>{
        const target=targets[index];
        if(!target||!parent.animate){onArrive(card.uid);resolve();return;}
        const figure=document.createElement('div');
        figure.className='flying-card-back';figure.setAttribute('aria-hidden','true');
        figure.innerHTML='<span>✧</span><i></i>';
        figure.style.width=target.width+'px';figure.style.height=target.height+'px';
        parent.append(figure);
        const from=`translate(${source.x-target.width/2}px,${source.y-target.height/2}px) scale(${source.width/target.width},${source.height/target.height}) rotate(-14deg)`;
        const to=`translate(${target.x-target.width/2}px,${target.y-target.height/2}px) scale(1) rotate(0deg)`;
        let settled=false,animation;
        const flight={finish(){
          if(settled)return;settled=true;
          animation?.cancel();figure.remove();flights.delete(flight);
          if(!disposed)onArrive(card.uid);
          resolve();
        }};
        flights.add(flight);
        animation=figure.animate([
          {transform:from,opacity:0},
          {transform:from,opacity:1,offset:.08},
          {transform:to,opacity:1,offset:.9},
          {transform:to,opacity:0},
        ],{duration:560,delay:index*90+(reshuffle?180:0),easing:'cubic-bezier(.2,.7,.2,1)',fill:'both'});
        animation.finished.then(flight.finish,flight.finish);
      })));
    },
    destroy(){disposed=true;finish();observer.disconnect();},
  };
}
