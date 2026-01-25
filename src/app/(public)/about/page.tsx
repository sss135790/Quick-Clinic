"use client";

import {
  SiNextdotjs,
  SiTypescript,
  SiTailwindcss,
  SiPrisma,
  SiPostgresql,
  SiSocketdotio,
  SiNodedotjs,
  SiDocker,
  SiGithub,
  SiLinkedin,
  SiInstagram,
  SiLeetcode,
  SiCodeforces,
  SiCodechef,
  SiGeeksforgeeks,
  SiX,
} from "react-icons/si";

import { Mail, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-10">

      {/* PAGE HEADER */}
      <div className="max-w-4xl mx-auto mb-12">
        <h1 className="text-4xl md:text-5xl font-semibold text-center mb-4 text-foreground">
          About Quick Clinic
        </h1>
        <p className="text-center text-muted-foreground max-w-3xl mx-auto text-base md:text-lg">
          Quick Clinic is a modern healthcare platform built to simplify doctor–patient interactions.
          From real-time chat to appointment scheduling, we deliver a seamless, secure, and scalable experience using cutting-edge technologies.
        </p>
      </div>

      {/* TECH STACK SECTION */}
      <TechStackSection />

      {/* CONTRIBUTORS SECTION */}
      <ContributorsSection />

    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                TECH SECTION                                 */
/* -------------------------------------------------------------------------- */

function TechStackSection() {
  return (
    <section className="max-w-6xl mx-auto mb-16">
      <h2 className="text-3xl md:text-4xl font-semibold mb-8 text-foreground text-center">
        Technologies Used
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">

        <TechCard icon={<SiNextdotjs size={40} />} name="Next.js" />
        <TechCard icon={<SiTypescript size={40} color="#3178C6" />} name="TypeScript" />
        <TechCard icon={<SiTailwindcss size={40} color="#38BDF8" />} name="Tailwind CSS" />
        <TechCard icon={<SiPrisma size={40} />} name="Prisma ORM" />
        <TechCard icon={<SiPostgresql size={40} color="#336791" />} name="PostgreSQL" />

        <TechCard icon={<SiSocketdotio size={40} />} name="Socket.IO" />
        <TechCard icon={<SiNodedotjs size={40} color="#3C873A" />} name="Node.js" />
        <TechCard icon={<SiDocker size={40} color="#0db7ed" />} name="Docker" />

      </div>
    </section>
  );
}

function TechCard({ icon, name }: { icon: any; name: string }) {
  return (
    <Card className="flex flex-col items-center p-6 hover:shadow-md transition-shadow border">
      <CardContent className="flex flex-col items-center p-0">
        <div className="text-4xl mb-3 text-muted-foreground">{icon}</div>
        <p className="text-sm font-medium text-foreground">{name}</p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                           CONTRIBUTORS SECTION                               */
/* -------------------------------------------------------------------------- */

function ContributorsSection() {
  return (
    <section className="max-w-6xl mx-auto mb-16">
      <h2 className="text-3xl md:text-4xl font-semibold mb-8 text-foreground text-center">
        Project Contributors
      </h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">

        {/* ---------------------- SHWET SINGH ---------------------- */}
        <ContributorCard
          name="Shwet Singh"
          role="Full-Stack Developer | Lead Architect | DevOps"
          bio="Built the end-to-end architecture, backend microservices, devops pipeline, and system design for Quick Clinic."
          instagram="https://www.instagram.com/_.shwet._6/"
          linkedin="https://www.linkedin.com/in/shwetsingh116/"
          github="https://github.com/sss135790"
          portfolio="#"
          mail="shwetsingh32@gmail.com"
          codeforces="https://codeforces.com/profile/5hwet5ingh"
          leetcode="https://leetcode.com/u/5hwet5ingh/"
          codechef="https://www.codechef.com/users/erxcoder33"
          geeksforgeeks="https://www.geeksforgeeks.org/profile/shwetsingh0k"
          x="#"
          image="#"
        />

        {/* ---------------------- PRIYANSHU GOYAL ---------------------- */}
        <ContributorCard
          name="Priyanshu Goyal"
          role="Full-Stack Developer | Frontend Specialist"
          bio="Responsible for UI/UX design, frontend implementation, and component architecture."
          instagram="#"
          linkedin="#"
          github="#"
          portfolio="#"
          mail="#"
        // Add other links if available
        />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                           CONTRIBUTOR CARD                                   */
/* -------------------------------------------------------------------------- */


function ContributorCard({
  name,
  role,
  bio,
  instagram,
  linkedin,
  github,
  portfolio,
  mail,
  codeforces,
  leetcode,
  codechef,
  geeksforgeeks,
  x,
  image,
}: any) {
  return (
    <Card className="hover:shadow-md transition-shadow border overflow-hidden">
      {image && (
        <div className="w-full h-64 bg-muted relative">
          <img src={image} alt={name} className="w-full h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-foreground">
          {name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-3 text-sm font-medium text-primary">{role}</p>
        <p className="text-muted-foreground text-sm mb-6">{bio}</p>
        <div className="flex flex-wrap gap-3 text-lg">
          {github && <a href={github} target="_blank" rel="noopener noreferrer" title="GitHub"><SiGithub /></a>}
          {linkedin && <a href={linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn"><SiLinkedin color="#0A66C2" /></a>}
          {instagram && <a href={instagram} target="_blank" rel="noopener noreferrer" title="Instagram"><SiInstagram color="#E1306C" /></a>}
          {x && <a href={x} target="_blank" rel="noopener noreferrer" title="X (Twitter)"><SiX /></a>}
          {portfolio && <a href={portfolio} target="_blank" rel="noopener noreferrer" title="Portfolio"><Globe /></a>}
          {mail && <a href={`mailto:${mail}`} title="Email"><Mail /></a>}
          {leetcode && <a href={leetcode} target="_blank" rel="noopener noreferrer" title="LeetCode"><SiLeetcode color="#FFA116" /></a>}
          {codeforces && <a href={codeforces} target="_blank" rel="noopener noreferrer" title="CodeForces"><SiCodeforces color="#1F8ACB" /></a>}
          {codechef && <a href={codechef} target="_blank" rel="noopener noreferrer" title="CodeChef"><SiCodechef color="#5B4638" /></a>}
          {geeksforgeeks && <a href={geeksforgeeks} target="_blank" rel="noopener noreferrer" title="GeeksForGeeks"><SiGeeksforgeeks color="#2F8D46" /></a>}
        </div>
      </CardContent>
    </Card>
  );
}
