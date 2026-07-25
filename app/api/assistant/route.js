import { NextResponse } from 'next/server';
import { localAssistantReply } from '@/lib/localAssistant';

const SYSTEM_PROMPT_HEADER = `Wewe ni "Msaidizi", msaidizi wa AI ndani ya "Mfumo wa Biashara" — programu ya
bookkeeping kwa biashara ndogo (mauzo ya bidhaa kama karanga, mbaazi n.k). Kazi yako:
- Jibu maswali ya mmiliki wa biashara kwa Kiswahili, kwa ufupi, wazi, na kwa lugha rahisi.
- Tumia TU namba na taarifa zilizotolewa chini ya "TAARIFA ZA BIASHARA" — usibuni namba.
  Ukikosa taarifa ya kutosha kujibu swali fulani, sema hivyo waziwazi badala ya kukisia.
- Unaweza kutoa ushauri wa jumla wa kibiashara (mf. jinsi ya kuboresha faida, kufuatilia
  madeni, kuwahudumia wateja bora), lakini kwa msingi wa namba zilizopo, si nadharia tupu.
- Kama swali halihusiani na biashara hii, jibu kwa ufupi kisha mkumbushe kwa upole kuwa
  wewe ni msaidizi wa biashara yake.
- Usitoe ushauri wa kisheria au kikodi kama ushauri rasmi — sema anaweza kuongea na
  mtaalamu (mhasibu/mwanasheria) kwa mambo hayo.`;

export async function POST(request) {
  let message, history, context;
  try {
    ({ message, history, context } = await request.json());
  } catch (e) {
    return NextResponse.json({ error: 'Ujumbe usio sahihi.' }, { status: 400 });
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Andika swali kwanza.' }, { status: 400 });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: localAssistantReply(message, context),
        source: 'local',
        note: 'ANTHROPIC_API_KEY haijawekwa - hii ni majibu ya Msaidizi wa Ndani (bure, bila AI kamili).',
      });
    }

    const systemPrompt = `${SYSTEM_PROMPT_HEADER}\n\nTAARIFA ZA BIASHARA (zilizohesabiwa leo):\n${JSON.stringify(context || {}, null, 2)}`;

    const safeHistory = Array.isArray(history)
      ? history
          .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
          .slice(-8)
      : [];

    const messages = [...safeHistory, { role: 'user', content: message }];

    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 700,
          system: systemPrompt,
          messages,
        }),
      });
    } catch (networkErr) {
      // Mtandao/timeout - tumia Msaidizi wa Ndani badala ya kushindwa kabisa
      return NextResponse.json({
        reply: localAssistantReply(message, context),
        source: 'local',
        note: 'Imeshindikana kufikia Claude API (mtandao) - hii ni majibu ya Msaidizi wa Ndani.',
      });
    }

    if (!res.ok) {
      // 401 (funguo batili), 429 (salio/kiwango kimeisha), 5xx (Anthropic ina tatizo) -> rudi kwenye Msaidizi wa Ndani
      const errText = await res.text();
      const isQuotaOrAuth = [401, 403, 429, 529].includes(res.status) || res.status >= 500;
      if (isQuotaOrAuth) {
        return NextResponse.json({
          reply: localAssistantReply(message, context),
          source: 'local',
          note: `Claude API haipatikani kwa sasa (${res.status}) - huenda salio la $ limeisha au funguo si sahihi. Hii ni majibu ya Msaidizi wa Ndani.`,
        });
      }
      return NextResponse.json({ error: `Hitilafu kutoka Claude API (${res.status}): ${errText}` }, { status: 502 });
    }

    const data = await res.json();
    const text = (data.content || [])
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n')
      .trim();

    return NextResponse.json({ reply: text || localAssistantReply(message, context), source: 'ai' });
  } catch (e) {
    // Hitilafu isiyotarajiwa - bado tunatoa jibu la ndani badala ya kushindwa kabisa
    return NextResponse.json({
      reply: localAssistantReply(message, context),
      source: 'local',
      note: 'Hitilafu isiyotarajiwa - hii ni majibu ya Msaidizi wa Ndani.',
    });
  }
}
