"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Crown, Search, Shield, Swords, Trophy } from "lucide-react";
import "./DuelistLeaderboard.css";

type Profile = { userId: string; name: string; image: string; wins: number; losses: number; rankName: string; rankKey: string };
export default function DuelistLeaderboard({ players, userId, onClose }: { players: Profile[]; userId: string; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [rank, setRank] = useState("all");
  const [page, setPage] = useState(0);
  const ranked = useMemo(()=>players.filter(player=>player.wins>0).slice().sort((a,b)=>b.wins-a.wins||a.losses-b.losses||a.name.localeCompare(b.name,"th")),[players]);
  const ranks = [...new Map(ranked.map(player=>[player.rankKey,player.rankName])).entries()];
  const filtered = ranked.filter(player=>(rank === "all" || player.rankKey === rank)&&player.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const pages = Math.max(1,Math.ceil(filtered.length/10));
  const currentPage = Math.min(page,pages-1);
  const ownIndex = ranked.findIndex(player=>player.userId === userId);
  const own = ranked[ownIndex];
  const top = [3,1,0,2,4].map(index=>({player:ranked[index],position:index+1}));
  return <section className="nexora-ranking" role="dialog" aria-modal="true" aria-label="อันดับนักดวล">
    <header className="nexora-ranking-nav"><button onClick={onClose}><ArrowLeft size={18}/> HOME</button><span><Swords size={18}/> BATTLE</span><strong><Crown size={20}/> RANKING</strong><span><Trophy size={18}/> LEADERBOARD</span></header>
    <div className="nexora-ranking-showcase"><div className="nexora-ranking-title"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME"/><h1>LEADERBOARD</h1><p>อันดับนักดวล NEXORA</p></div><div className="nexora-ranking-total"><Crown size={22}/><strong>PvP RANKING</strong><span>{ranked.length.toLocaleString()} นักดวล</span></div>
      <div className="nexora-ranking-podium">{top.map(({player,position})=><article key={position} data-place={position} data-empty={!player}><div className="nexora-ranking-portrait">{player && <img src={player.image || "/avatar.png"} alt={player.name}/>}</div><div className="nexora-ranking-pedestal"><div className="nexora-ranking-position">{position === 1 && <Crown/>}{position}</div><h2>{player?.name || "—"}</h2><small>{player?.rankName || "—"}</small><strong><Crown size={18}/>{player ? player.wins.toLocaleString() : "—"}</strong></div></article>)}</div>
    </div>
    <div className="nexora-ranking-board"><aside aria-label="กรองแรงค์"><button aria-pressed={rank === "all"} onClick={()=>{setRank("all");setPage(0);}}><Crown size={18}/> ALL</button>{ranks.map(([key,name])=><button key={key} aria-pressed={rank===key} onClick={()=>{setRank(key);setPage(0);}}><Shield size={18}/>{name}</button>)}</aside><div className="nexora-ranking-table-wrap"><table><thead><tr><th>RANK</th><th>PLAYER</th><th>แรงค์</th><th>ชนะ</th><th>WIN RATE</th><th>TOTAL MATCH</th><th>แพ้</th></tr></thead><tbody>{filtered.slice(currentPage*10,currentPage*10+10).map(player=>{const total=player.wins+player.losses;const rate=total?Math.round(player.wins/total*100):0;return <tr key={player.userId} data-own={player.userId===userId}><td>{ranked.indexOf(player)+1}</td><td><img src={player.image || "/avatar.png"} alt=""/><span>{player.name}</span></td><td>{player.rankName}</td><td><Crown size={14}/>{player.wins.toLocaleString()}</td><td><meter min={0} max={100} value={rate}/><span>{rate}%</span></td><td>{total.toLocaleString()}</td><td>{player.losses.toLocaleString()}</td></tr>;})}</tbody></table>{!filtered.length && <div className="nexora-ranking-empty">{query ? "ไม่พบนักดวลที่ค้นหา" : "ยังไม่มีข้อมูลอันดับ"}</div>}</div></div>
    <footer className="nexora-ranking-footer"><div className="nexora-ranking-own"><Crown size={18}/><b>MY RANK</b><span>{ownIndex>=0?ownIndex+1:"—"}</span>{own && <><img src={own.image || "/avatar.png"} alt=""/><strong>{own.name}</strong><span>{own.rankName}</span></>}</div><nav aria-label="หน้าอันดับ"><button title="หน้าก่อน" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}><ChevronLeft/></button><span>{currentPage+1} / {pages}</span><button title="หน้าถัดไป" disabled={currentPage+1>=pages} onClick={()=>setPage(currentPage+1)}><ChevronRight/></button></nav><label><Search size={18}/><input value={query} onChange={event=>{setQuery(event.target.value);setPage(0);}} placeholder="ค้นหาชื่อผู้เล่น..." aria-label="ค้นหาชื่อผู้เล่น"/></label></footer>
  </section>;
}
