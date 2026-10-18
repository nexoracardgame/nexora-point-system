import {notFound} from 'next/navigation';
import {gameWorldSections} from '@/lib/game-world-sections';

export function generateStaticParams(){return gameWorldSections.map(item=>({section:item.id}))}
export default async function GameWorldPage({params}:{params:Promise<{section:string}>}){
 const {section}=await params;
 const item=gameWorldSections.find(item=>item.id===section);
 if(!item)notFound();
 return <section className="nx-world-page" aria-labelledby="nx-world-title"><span className="nx-site-eyebrow">NEXORA / {item.label}</span><h1 id="nx-world-title">{item.title}</h1><div className="nx-world-page-rule"/></section>;
}
