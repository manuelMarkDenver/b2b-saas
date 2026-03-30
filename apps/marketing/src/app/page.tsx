import { Navbar } from '@/components/navbar';
import { Hero } from '@/components/hero';
import { SocialProof } from '@/components/social-proof';
import { FeaturesGrid } from '@/components/features-grid';
import { HowItWorks } from '@/components/how-it-works';
import { DemoSection } from '@/components/demo-section';
import { Testimonials } from '@/components/testimonials';
import { CtaSection } from '@/components/cta-section';
import { Footer } from '@/components/footer';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <SocialProof />
        <FeaturesGrid />
        <HowItWorks />
        <DemoSection />
        <Testimonials />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
