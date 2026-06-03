#!/usr/bin/env python3
"""
Generate fresh agent output using Claude, then re-render the portal.
Called by the GitHub Actions workflow.

Reads the Mac Daddy File from index.html (embedded in agentOutputs.macdaddy),
calls Claude to generate new LinkedIn or Blog content,
updates the embedded agentOutputs in index.html.
"""
import os
import re
import json
import anthropic
from datetime import datetime

AGENT_TYPE = os.environ["AGENT_TYPE"]  # "linkedin" or "blog"

def extract_mac_daddy_from_html(html_path):
    """Pull the macdaddy content from the embedded agentOutputs JSON."""
    with open(html_path, "r") as f:
        html = f.read()
    # Find the agentOutputs assignment
    m = re.search(r'const agentOutputs = ({.*?});', html, re.DOTALL)
    if not m:
        raise ValueError("Could not find agentOutputs in index.html")
    outputs = json.loads(m.group(1))
    return outputs, outputs.get("macdaddy", "")

def generate_content(mac_daddy, agent_type):
    """Call Claude to generate fresh content."""
    client = anthropic.Anthropic()

    if agent_type == "linkedin":
        system = f"""You are a CORE Growth System LinkedIn Post Generator agent. Generate 3 LinkedIn posts based on the client's Mac Daddy File. Write in the client's documented brand voice (F3.3). Each post should:
- Open with a strong hook
- Align to a content pillar from F5.1
- Be 150-300 words
- Include hashtags
- Be distinct in style (story, data-led, challenger POV)

Today is {datetime.now().strftime('%B %d, %Y')}.

MAC DADDY FILE:
{mac_daddy[:10000]}"""
        user_msg = "Generate 3 fresh LinkedIn posts for this week. Use specific details from the Mac Daddy File — real names, real differentiators, real competitive intelligence."

    elif agent_type == "blog":
        system = f"""You are a CORE Growth System Blog Pipeline Agent. Generate a complete blog content brief based on the client's Mac Daddy File. Include:
1. Recommended topic (aligned to content pillars F5.1)
2. Title options (3 variations)
3. Target persona (from F2)
4. SEO keywords
5. Full outline with section summaries
6. Evidence/proof points from competitive intelligence
7. CTA recommendation

Today is {datetime.now().strftime('%B %d, %Y')}.

MAC DADDY FILE:
{mac_daddy[:10000]}"""
        user_msg = "Generate a fresh blog content brief that addresses a key pain point for the primary buyer persona and differentiates the client from named competitors."
    else:
        raise ValueError(f"Unknown agent type: {agent_type}")

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": user_msg}]
    )
    return message.content[0].text

def update_html(html_path, agent_type, new_content):
    """Replace the agent output in the embedded agentOutputs JSON."""
    with open(html_path, "r") as f:
        html = f.read()

    m = re.search(r'const agentOutputs = ({.*?});', html, re.DOTALL)
    if not m:
        raise ValueError("Could not find agentOutputs in index.html")

    outputs = json.loads(m.group(1))

    # Add timestamp header
    header = f"# {'LINKEDIN POSTS' if agent_type == 'linkedin' else 'BLOG PIPELINE'} — Live Agent Output\n"
    header += f"**Generated:** {datetime.now().strftime('%B %d, %Y at %I:%M %p UTC')}\n"
    header += f"**Agent:** CORE {'LinkedIn Post Generator' if agent_type == 'linkedin' else 'Blog Pipeline'} Agent\n"
    header += f"**Mode:** Live Run (Claude API)\n\n---\n\n"

    outputs[agent_type] = header + new_content

    # Replace in HTML — careful with JSON encoding
    new_json = json.dumps(outputs, ensure_ascii=False)
    # Escape for JS embedding (backticks, etc.)
    html = html[:m.start(1)] + new_json + html[m.end(1):]

    with open(html_path, "w") as f:
        f.write(html)

    print(f"Updated {agent_type} output in {html_path} ({len(new_content)} chars)")

def main():
    html_path = "index.html"
    print(f"Running {AGENT_TYPE} agent...")

    outputs, mac_daddy = extract_mac_daddy_from_html(html_path)
    print(f"Extracted Mac Daddy content: {len(mac_daddy)} chars")

    new_content = generate_content(mac_daddy, AGENT_TYPE)
    print(f"Generated {len(new_content)} chars of {AGENT_TYPE} content")

    update_html(html_path, AGENT_TYPE, new_content)
    print("Done!")

if __name__ == "__main__":
    main()
