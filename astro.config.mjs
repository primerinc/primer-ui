import { defineConfig } from 'astro/config';
import { storyblok } from '@storyblok/astro';
import node from '@astrojs/node';
import mkcert from 'vite-plugin-mkcert';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV, process.cwd(), '');

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    storyblok({
      accessToken: env.STORYBLOK_TOKEN,
      livePreview: true,
      components: {
        page:          'storyblok/Page',
        resource:      'storyblok/Page',
        campaign_page: 'storyblok/Page',
        hero:          'storyblok/Hero',
        feature_grid:  'storyblok/FeatureGrid',
        cta_banner:    'storyblok/CTABanner',
        logo_bar:      'storyblok/LogoBar',
        testimonials:  'storyblok/TestimonialBlock',
        two_column:    'storyblok/TwoColumn',
        rich_text:     'storyblok/RichText',
        stats_bar:     'storyblok/StatsBar',
        card_grid:     'storyblok/CardGrid',
        button:        'storyblok/Button',
        header:        'storyblok/Header',
        footer:        'storyblok/Footer',
        team:          'storyblok/Team',
        tabs:          'storyblok/Tabs',
        faq:           'storyblok/FAQ',
        pricing_table: 'storyblok/PricingTable',
        contact_form:  'storyblok/ContactForm',
        process_steps: 'storyblok/ProcessSteps',
        video:         'storyblok/Video',
        case_study_layout: 'storyblok/CaseStudyLayout',
        key_takeaway_item: 'storyblok/KeyTakeawayItem',
        sidebar_cta:       'storyblok/SidebarCTA',
      },
      apiOptions: { region: 'eu' },
    }),
  ],
  vite: { plugins: [mkcert()] },
});
