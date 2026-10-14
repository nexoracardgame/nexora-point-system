export function freshDeck<T>(generate: () => T, previous: T, cards: (deck: T) => string[]): T {
  const signature = (deck: T) => cards(deck).slice().sort().join(",");
  const before = signature(previous);
  let next = generate();
  for (let attempt = 0; attempt < 24 && signature(next) === before; attempt++) next = generate();
  return next;
}

export function randomTriadDeck(pool: { cardNo: string; kind: string }[], mode: string): string[] {
  const shuffled = pool.map(card => ({ card, order: Math.random() })).sort((a,b) => a.order-b.order).map(item=>item.card);
  const monsters = shuffled.filter(card=>card.kind === "monster");
  const skills = shuffled.filter(card=>card.kind === "skill");
  let chosen = mode === "monster" ? monsters.slice(0,20) : mode === "skill" ? [...monsters.slice(0,10),...skills.slice(0,10)] : [...monsters.slice(0,3),...shuffled.filter(card=>!monsters.slice(0,3).includes(card)).slice(0,17)];
  if (chosen.length !== 20 || new Set(chosen.map(card=>card.cardNo)).size !== 20) throw new Error("การ์ดในพูลไม่พอสำหรับจัดเด็คตามโหมด");
  return chosen.map(card=>card.cardNo);
}
