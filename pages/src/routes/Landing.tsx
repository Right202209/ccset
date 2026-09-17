import { FadeInSection } from '../components/FadeInSection.js'
import { Agents } from '../components/landing/Agents.js'
import { Features } from '../components/landing/Features.js'
import { FileSafety } from '../components/landing/FileSafety.js'
import { Hero } from '../components/landing/Hero.js'
import { Highlights } from '../components/landing/Highlights.js'
import { QuickStart } from '../components/landing/QuickStart.js'

/** The landing route: hero plus one section per landing component. */
export function Landing() {
  return (
    <>
      <Hero />
      <FadeInSection>
        <Highlights />
      </FadeInSection>
      <FadeInSection>
        <Agents />
      </FadeInSection>
      <FadeInSection>
        <Features />
      </FadeInSection>
      <FadeInSection>
        <FileSafety />
      </FadeInSection>
      <FadeInSection>
        <QuickStart />
      </FadeInSection>
    </>
  )
}
