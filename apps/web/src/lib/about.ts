/** About-page content. Shapes mirror the future settings API; sample data until it exists. */
export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  photoUrl: string | null;
}

export interface Arm {
  abbr: string;
  name: string;
  text: string;
}

export interface AboutSettings {
  team: TeamMember[];
  arms: Arm[];
}

export const sampleAbout: AboutSettings = {
  team: [
    { name: "Dr. Adetokunbo O. Ilesanmi", role: "President", bio: "Prophet and teacher; pastored for about eighteen years before being released to serve the wider Body of Christ.", photoUrl: null },
    { name: "Dr. Oluwatoyin O. Ilesanmi", role: "Vice President", bio: "Short bio to come.", photoUrl: null },
    { name: "Dr. Faith I. Ilesanmi", role: "Faith-Feast", bio: "Short bio to come.", photoUrl: null },
    { name: "Brother Samuel Emmanuel", role: "Team member", bio: "Short bio to come.", photoUrl: null },
  ],
  arms: [
    { abbr: "SALTI", name: "KCOM Salt and Light Training Institute", text: "A Bible-based, interdenominational institute training Christian leaders and godly achievers to activate their visions and actualise their missions." },
    { abbr: "FIRE", name: "Faith-Intercession Revival Force (F-I-R-E Force)", text: "The intercessory arm, including the FIRE Force Conventions." },
    { abbr: "IPSI", name: "Intensive Prophetic Strategic Intercession", text: "Focused seasons of prophetic, strategic prayer." },
  ],
};

export async function getAbout(): Promise<AboutSettings> {
  return sampleAbout;
}

export const aboutLinks = [
  { label: "Who We Are", href: "/about" },
  { label: "Team and Arms", href: "/about/team" },
] as const;
