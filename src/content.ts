export const LINKS = {
  github: 'https://github.com/utkarshraj11',
  linkedin: 'https://www.linkedin.com/in/utkarshraj11/',
  email: 'utkarsh.alok26@gmail.com',
  resume: `${import.meta.env.BASE_URL}resume.pdf`,
};

/** Set to e.g. `${import.meta.env.BASE_URL}portrait.jpg` once public/portrait.jpg exists. */
export const PORTRAIT_URL: string | null = null;

export const FACTS: ReadonlyArray<readonly [string, string]> = [
  ['now', 'M.S. Computer Science, UC Riverside'],
  ['prev', 'Full Stack Developer, Hewlett Packard Enterprise'],
  ['based', 'Riverside, California'],
  ['next', 'Summer 2027 software engineering internships'],
];

export const WORK = [
  {
    org: 'Hewlett Packard Enterprise',
    dates: '08/2021 – 02/2026',
    role: 'Full Stack Developer · Bengaluru, India',
    body: 'Product and platform work side by side. I built a distributed real-time messaging service (chat, notifications, email-to-chat) reused by 3 platforms, and was a core contributor to a multi-tenant GitOps platform on Azure Kubernetes Service serving 17+ teams and 100+ microservices. I also tuned data services ingesting 1M+ records/hour from 15s fetches to 3s, and helped migrate critical applications to HPE Private Cloud, cutting $900K in annual cloud costs.',
  },
  {
    org: 'PES University',
    dates: '01/2022 – 05/2022',
    role: 'Teaching Assistant, Image Processing and Computer Vision',
    body: 'Built hands-on lab assignments in Python with OpenCV and NumPy covering image segmentation, cropping and edge detection.',
  },
  {
    org: 'Mast Global',
    dates: '01/2021 – 06/2021',
    role: 'Intern, Digital Process Automation',
    body: 'Cut real-time stock data fetch time from 4 hours to 30 minutes by moving Selenium WebDriver automation to a scheduled service.',
  },
];

/** Add `url` to a project to link its title. */
export const PROJECTS: ReadonlyArray<{ title: string; body: string; tags: string; url?: string }> = [
  {
    title: 'Web Search Engine',
    body: 'A multithreaded, robots.txt-compliant crawler, a PageRank scorer over the link graph, and a Lucene BM25 index served through a Flask search UI.',
    tags: 'python · pylucene · flask · docker',
  },
  {
    title: 'Predictive Reply Suggestions',
    body: "AI reply suggestions for HPE's Workbench chat; users approve or edit every one. Winner, HPE DT Hackathon 2023.",
    tags: 'react · power automate · ai builder',
  },
];

export const STACK: ReadonlyArray<readonly [string, string]> = [
  ['Languages', 'Python, Java, TypeScript, JavaScript, SQL, Groovy, Bash'],
  ['Frameworks', 'React, Node.js, NestJS, Express.js, Spring Boot, Flask, Dapr, Socket.IO, Prisma, Jest'],
  ['Data & messaging', 'PostgreSQL, SQL Server, MongoDB, Cosmos DB, Redis, Elasticsearch, Azure Event Hub'],
  ['Cloud & DevOps', 'Azure, AKS, Kubernetes, Docker, Helm, Terraform, ArgoCD, Jenkins, GitHub Actions, Istio, Prometheus, Grafana'],
];
