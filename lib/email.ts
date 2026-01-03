import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface BrokenLink {
    foundOn: string;
    target: string;
    status: number;
}

export async function sendReportEmail(to: string, url: string, brokenLinks: BrokenLink[]) {
    if (!brokenLinks.length) return;

    const html = `
    <h1>Dead Link Report for ${url}</h1>
    <p>We found <strong>${brokenLinks.length}</strong> broken links on your site.</p>
    
    <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr>
          <th>Link Target</th>
          <th>Found On</th>
          <th>Status Code</th>
        </tr>
      </thead>
      <tbody>
        ${brokenLinks.map(link => `
          <tr>
            <td><a href="${link.target}">${link.target}</a></td>
            <td>${link.foundOn}</td>
            <td style="color: red; font-weight: bold;">${link.status}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <p>
      <a href="https://dead-link-sentinel.vercel.app/dashboard">View full report</a>
    </p>
  `;

    try {
        await resend.emails.send({
            from: 'Dead Link Sentinel <onboarding@resend.dev>', // Default Resend testing domain. User must verify their own domain to change this.
            to: [to], // Resend Free tier only sends to the verified email (usually the account owner)
            subject: `[Alert] ${brokenLinks.length} Broken Links on ${url}`,
            html,
        });
        console.log(`Email sent to ${to} for ${url}`);
    } catch (error) {
        console.error('Failed to send email:', error);
    }
}
