export default {
  source: [
    'tokens/primitives.json',
    'tokens/semantic.json'
  ],
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
