export function battleBotOutcome(winner:string,side:string,own:number,enemy:number){
 return (winner===side?1_000_000:winner==='draw'?0:-1_000_000)+Math.max(-100_000,Math.min(100_000,own-enemy));
}
export function battleBotRisk(values:number[]){
 if(!values.length)return -Infinity;
 return Math.min(...values)*.7+values.reduce((sum,value)=>sum+value,0)/values.length*.3;
}
