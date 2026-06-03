// Netlify serverless function — proxies to Anthropic Claude API
// Set ANTHROPIC_API_KEY in Netlify dashboard > Site settings > Environment variables

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: corsHeaders() });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured. Add it in Netlify Dashboard > Site settings > Environment variables.' }),
      { status: 500, headers: corsHeaders() }
    );
  }

  try {
    const body = await req.json();
    const { agentType, macDaddyContext } = body;

    if (!agentType || !macDaddyContext) {
      return new Response(JSON.stringify({ error: 'Missing agentType or macDaddyContext' }), { status: 400, headers: corsHeaders() });
    }

    const systemPrompt = buildSystemPrompt(agentType, macDaddyContext);
    const userPrompt = buildUserPrompt(agentType);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await resp.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message }), { status: 500, headers: corsHeaders() });
    }

    const content = data.content?.[0]?.text || 'No content generated';
    return new Response(
      JSON.stringify({ output: content, agentType, generated: new Date().toISOString() }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders() });
  }
};

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function buildSystemPrompt(agentType, macDaddy) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const base = `You are a CORE Growth System marketing agent. You generate actionable marketing content based on the client's Mac Daddy File (Marketing Source of Truth). Write in the client's documented brand voice. Be specific — use real names, real numbers, real competitive intelligence from the Mac Daddy File. Today is ${today}.

MAC DADDY FILE (excerpt — key sections):
${macDaddy.slice(0, 12000)}`;

  if (agentType === 'linkedin') {
    return base + `

You are the LinkedIn Post Generator agent. Generate 3 LinkedIn posts in the client's documented brand voice with different style variations. Each post should:
- Open with a strong hook (pattern interrupt, contrarian take, or data point)
- Align to one of the client's content pillars from the Mac Daddy File
- Include a call-to-action
- Follow the voice principles documented in F3.3
- Be 150-300 words each
- Include 3-5 relevant hashtags
- Note the content pillar alignment

Format with clear headers: **POST 1**, **POST 2**, **POST 3** with pillar tags and style notes.`;
  }

  if (agentType === 'blog') {
    return base + `

You are the Blog Pipeline Agent. Generate a complete blog content brief including:
1. **Recommended topic** aligned to the client's content pillars and buyer personas
2. **Title options** (3 variations — one direct, one curiosity-driven, one data-led)
3. **Target persona** from the Mac Daddy File's F2 section
4. **SEO keywords** (primary + 3-5 secondary)
5. **Full outline** with section summaries (intro, 3-4 body sections, conclusion)
6. **Key evidence/proof points** to include from the Mac Daddy competitive intelligence
7. **CTA recommendation**
8. **Content pillar** alignment
9. **Estimated word count** and reading time

Format as clean markdown. Make it specific to the client's industry position and content strategy.`;
  }

  return base;
}

function buildUserPrompt(agentType) {
  if (agentType === 'linkedin') {
    return 'Generate 3 fresh LinkedIn posts for this week. Make each post distinct in style — one story/narrative, one data-led with specific proof points, and one challenger/POV that takes a strong position. Pull specific details from the Mac Daddy File — real competitor names, real differentiators, real numbers.';
  }
  if (agentType === 'blog') {
    return 'Generate a fresh blog content brief. Pick a topic that addresses a key pain point for the primary buyer persona, differentiates the client from competitors named in the Mac Daddy File, and advances the positioning strategy. Include enough detail that a writer could produce a first draft from this brief alone.';
  }
  return 'Generate fresh agent output based on the Mac Daddy File.';
}

export const config = { path: "/api/run-agent" };
