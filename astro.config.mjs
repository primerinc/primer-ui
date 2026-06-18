import { defineConfig } from 'astro/config';
import { storyblok } from '@storyblok/astro';
import mkcert from 'vite-plugin-mkcert';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV, process.cwd(), '');

export default defineConfig({
  integrations: [
    storyblok({
      accessToken: env.STORYBLOK_TOKEN,
      components: {
        page:          'storyblok/Page',
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
      },
      apiOptions: { region: '' },
    }),
  ],
  vite: { plugins: [mkcert()] },
});
