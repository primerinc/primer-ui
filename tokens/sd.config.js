const theme = process.env.PRIMER_THEME;

const sources = [
  'tokens/primitives.json',
  'tokens/semantic.json',
  ...(theme ? [`tokens/themes/${theme}.json`] : [])
];

export default {
  source: sources,
  platforms: {
    css: {
      transformGroup: 'css',
      prefix: 'p',
      buildPath: 'tokens/dist/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: {
            selector: ':root',
            outputReferences: false
          }
        }
      ]
    }
  }
}
