type Approval = { memberNo: string; name: string; approvedAt: string; messageId: string };

async function discordRead(url: string, options: RequestInit = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, {...options,cache:'no-store',signal:AbortSignal.timeout(10000)});
    if (response.status !== 429 || attempt === 3) return response;
    const rate = await response.json().catch(() => ({}));
    const delay = Math.min(5000, Math.max(300, Number(rate.retry_after || 1) * 1000));
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error('Approval rate limit');
}

export async function readApprovalHistory(body: Record<string, unknown>, botToken: string) {
  const urls = body.webhookUrls;
  if (!Array.isArray(urls) || !urls.length || urls.length > 4 || !/^\d{17,20}$/.test(String(body.guildId || ''))) throw new Error('Invalid approval log source');
  const sources = new Map<string, Set<string>>();
  const webhookPaths = new Map<string, string>();
  for (const raw of new Set(urls)) {
    const match = String(raw).match(/^https:\/\/(?:(?:ptb\.|canary\.)?discord\.com|discordapp\.com)\/api(?:\/v\d+)?\/webhooks\/(\d{17,20})\/([A-Za-z0-9_-]+)$/);
    if (!match) throw new Error('Invalid approval webhook');
    if (webhookPaths.has(match[1])) continue;
    const response = await discordRead(`https://discord.com/api/v10/webhooks/${match[1]}/${match[2]}`);
    if (!response.ok) throw new Error('Approval webhook HTTP '+response.status);
    const hook = await response.json();
    if (hook.guild_id !== body.guildId || !/^\d{17,20}$/.test(hook.channel_id || '')) continue;
    const ids = sources.get(hook.channel_id) || new Set<string>();
    ids.add(match[1]); sources.set(hook.channel_id, ids);
    webhookPaths.set(match[1], `${match[1]}/${match[2]}`);
  }
  if (!sources.size) throw new Error('Approval log unavailable');
  const approvals: Approval[] = [];
  for (const [channel, webhookIds] of sources) {
    let before = '';
    for (let page=0;page<3;page++) {
      const response = await discordRead(`https://discord.com/api/v10/channels/${channel}/messages?limit=100${before ? '&before='+before : ''}`, {
        headers:{Authorization:`Bot ${botToken}`},cache:'no-store',signal:AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('Approval channel HTTP '+response.status);
      const messages = await response.json();
      if (!Array.isArray(messages)) throw new Error('Invalid approval log');
      for (let message of messages) {
        if (!webhookIds.has(message.webhook_id)) continue;
        // Bot message-content restrictions can hide embeds. Read our own webhook's
        // message with its existing token, without changing server-wide intents.
        if (!message.content && !message.embeds?.length && /^\d{17,20}$/.test(String(message.id))) {
          const detail = await discordRead(`https://discord.com/api/v10/webhooks/${webhookPaths.get(message.webhook_id)}/messages/${message.id}`);
          if (!detail.ok) throw new Error('Approval message HTTP '+detail.status);
          message = await detail.json();
        }
        const start = approvals.length;
        for (const embed of Array.isArray(message.embeds) ? message.embeds : []) {
          if (embed.title !== '✅ อนุมัติสมาชิกใหม่') continue;
          const field = (Array.isArray(embed.fields) ? embed.fields : []).find((f: {name?:string}) => f.name === 'สมาชิกที่ยื่นสมัคร');
          const value = String(field?.value || '');
          const number = value.match(/NUMBER:\s*\*\*NO\.(\d{1,3})\*\*/);
          const name = value.match(/ชื่อ IC:\s*\*\*([^\r\n]+?)\*\*/);
          const date = String(embed.timestamp || message.timestamp || '');
          if (!number || !name || Number(number[1])>300 || !Number.isFinite(Date.parse(date))) continue;
          approvals.push({memberNo:String(Number(number[1])),name:name[1].trim(),approvedAt:new Date(date).toISOString(),messageId:String(message.id)});
        }
        // The registration logger sends plain text if Discord rejects its embed.
        const content = String(message.content || '');
        if (approvals.length === start && content.startsWith('อนุมัติสมาชิกใหม่สำเร็จ')) {
          const applicant = content.match(/สมาชิกที่ยื่นสมัคร:\s*NO\.(\d{1,3})\s*\|\s*([^|\r\n]+)/);
          if (applicant && Number(applicant[1]) <= 300 && Number.isFinite(Date.parse(message.timestamp))) {
            approvals.push({memberNo:String(Number(applicant[1])),name:applicant[2].trim(),approvedAt:new Date(message.timestamp).toISOString(),messageId:String(message.id)});
          }
        }
      }
      if (messages.length<100 || approvals.length>=50) break;
      before = String(messages.at(-1)?.id || '');
      if (!/^\d{17,20}$/.test(before)) break;
    }
  }
  return {ok:true,approvals:approvals.sort((a,b)=>Date.parse(b.approvedAt)-Date.parse(a.approvedAt)).slice(0,100)};
}
