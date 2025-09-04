import { Anthropic } from '@anthropic-ai/sdk';

/**
 * Configuration for the SampleGenerator
 */
interface AISampleGeneratorConfiguration<T> {
  anthropic?: Anthropic;
  systemPrompt: string;
  userPrompt: string;
  transformer: (input: string) => T;
  summarizer: (result: T) => string;
  maxTokens?: number;
}

/**
 * Class for generating multiple AI samples with differentiation and error correction
 */
export class AISampleGenerator<T> {
  private readonly anthropic: Anthropic;
  private readonly systemPrompt: string;
  private readonly userPrompt: string;
  private readonly transformer: (input: string) => T;
  private readonly summarizer: (result: T) => string;
  private readonly maxTokens: number;

  private samples: T[] = [];
  private summaries: string[] = [];

  constructor(configuration: AISampleGeneratorConfiguration<T>) {
    this.anthropic = configuration.anthropic ?? new Anthropic();
    this.systemPrompt = configuration.systemPrompt + `

CRITICAL INSTRUCTIONS:
- Only output valid JSON that conforms to the schema
- Do NOT use markdown formatting or code blocks
- Do NOT include any explanatory text
- Output ONLY the raw JSON object`;
    this.userPrompt = configuration.userPrompt;
    this.transformer = configuration.transformer;
    this.summarizer = configuration.summarizer;
    this.maxTokens = configuration.maxTokens || 1500;
  }

  /**
   * Get current samples
   */
  get generatedSamples(): T[] {
    return [...this.samples];
  }

  /**
   * Add existing samples. This will ensure samples that are generated are different from these.
   */
  addExistingSamples(existingSamples: T[]): void {
    if (existingSamples.length === 0) {
      return;
    }

    console.log(`Adding ${existingSamples.length} existing sample(s) to generator`);
    this.samples.push(...existingSamples);
    for (const existingSample of existingSamples) {
      const summary = this.summarizer(existingSample);
      this.summaries.push(summary);
    }
  }

  /**
   * Helper function to safely extract error message
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  }

  /**
   * Helper function to build differentiation context from summaries
   */
  private buildPromptWithSummaries(basePrompt: string): string {
    // If no summaries, return base prompt
    if (this.summaries.length === 0) {
      return basePrompt;
    }

    // Build differentiation context
    const previousResultsSummary = this.summaries
      .map((summary, index) => `${index + 1}. ${summary}`)
      .join('\n');
    return `IMPORTANT: You have already generated ${this.summaries.length} result(s). Here are the details of what was already created:
    
${previousResultsSummary}

Please generate something DIFFERENT and UNIQUE from the above. Avoid duplicating concepts, themes, or characteristics that have already been used.

${basePrompt}`;
  }

  /**
   * Generates one sample and tracks iterations used
   */
  private async generate(iterationBudget: number): Promise<{
    sample: T | null,
    iterationsUsed: number,
  }> {
    let currentPrompt = this.userPrompt;
    let previousAttempt: string | null = null;
    let iteration = 0;
    while (iteration < iterationBudget) {
      try {
        // Build messages array with only current context
        const messages: any[] = [];
        if (previousAttempt) {
          // Include previous attempt and current prompt with error context
          messages.push({
            role: 'assistant',
            content: previousAttempt
          });
          messages.push({
            role: 'user',
            content: currentPrompt // This will contain the error message on subsequent iterations
          });
        } else {
          // First iteration or new generation - include differentiation context
          const promptWithContext = this.buildPromptWithSummaries(currentPrompt);
          messages.push({
            role: 'user',
            content: promptWithContext
          });
        }

        // Call Claude Opus 4
        const msg = await this.anthropic.messages.create({
          model: "claude-opus-4-20250514",
          max_tokens: this.maxTokens,
          temperature: 1,
          system: this.systemPrompt,
          messages: messages
        });

        const response = msg.content[0]?.type === 'text' ? msg.content[0].text : undefined;
        if (!response) {
          throw new Error('No response received from Claude');
        }

        // Apply transformer
        try {
          const sample = this.transformer(response.trim());
          this.samples.push(sample);

          // Generate the summary for this sample
          const summary = this.summarizer(sample);
          this.summaries.push(summary);

          // Log success with first line of summary
          const firstLineOfSummary = summary.split('\n')[0] || 'No summary available';
          console.log(`Iteration ${iteration + 1}: Generated: ${firstLineOfSummary}`);

          // Return the successfully generated sample
          return { sample, iterationsUsed: iteration + 1 };

        } catch (transformerError: unknown) {
          // Log failure with error message
          const errorMessage = this.getErrorMessage(transformerError);
          console.log(`Iteration ${iteration + 1}: ${errorMessage}`);

          // Update context for next iteration with specific transformation error
          previousAttempt = response;

          // Build error prompt with previous samples context
          currentPrompt = `Previous attempt failed with error: ${errorMessage}. Please adjust your output to fix this issue. Original request: ${this.userPrompt}`;
          iteration++;
        }
      } catch (apiError: unknown) {
        const errorMessage = this.getErrorMessage(apiError);
        console.log(`Iteration ${iteration + 1}: API error - ${errorMessage}`);

        // If it's the last iteration, break
        if (iteration + 1 >= iterationBudget) {
          break;
        }

        // On API error, reset the context and try again
        previousAttempt = null;
        currentPrompt = this.userPrompt;
        iteration++;
      }
    }

    // Failed to generate within iteration limit
    console.log(`Failed to generate sample after ${iterationBudget} iterations`);
    return { sample: null, iterationsUsed: iterationBudget };
  }

  /**
   * Attempt to generate exactly one sample within the given iteration budget.
   */
  async sample(iterationBudget: number = 10): Promise<T | null> {
    const result = await this.generate(iterationBudget);
    return result.sample;
  }

  /**
   * Generate as many samples as possible within the given iteration budget.
   */
  async sampleMany(iterationBudget: number = 25): Promise<T[]> {
    console.log(`Attempting to generate multiple samples with ${iterationBudget} total iterations`);
    const newSamples: T[] = [];
    let remainingIterations = iterationBudget;
    while (remainingIterations > 0) {
      // Try to generate one sample with remaining iterations
      const result = await this.generate(remainingIterations);
      remainingIterations -= result.iterationsUsed;
      if (result.sample) {
        newSamples.push(result.sample);
      }
    }
    console.log(`Generated ${newSamples.length} new sample(s) (total: ${this.samples.length})`);
    return newSamples;
  }
}
