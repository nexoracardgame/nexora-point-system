type Rect={left:number;right:number;top:number;bottom:number};

export function battleChatClearance(width:number,top:number,bottom:number,cards:Rect[],preferredWidth:number){
  const blocked=cards.filter(card=>card.bottom>top&&card.top<bottom).map(card=>({left:Math.max(12,card.left-8),right:Math.min(width-12,card.right+8)})).sort((a,b)=>a.left-b.left);
  const gaps:{left:number;width:number}[]=[];let left=12;
  for(const card of blocked){if(card.left>left)gaps.push({left,width:card.left-left});left=Math.max(left,card.right);}
  if(left<width-12)gaps.push({left,width:width-12-left});
  const gap=gaps.find(item=>item.width>=preferredWidth)||gaps.sort((a,b)=>b.width-a.width)[0];
  return gap?{left:gap.left,width:Math.max(0,Math.min(gap.width,preferredWidth))}:{left:12,width:0};
}
