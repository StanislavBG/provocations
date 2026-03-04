/**
 * AudioStreamPlayer — Web Audio API-based chunk player for gapless audio
 * playback from streaming base64-encoded audio chunks.
 *
 * Usage:
 *   const player = new AudioStreamPlayer();
 *   player.init();                        // call from user gesture
 *   player.onEnded = () => { ... };       // register completion callback
 *   await player.addChunk(base64Mp3);     // feed chunks as they arrive
 *   player.flush();                       // signal no more chunks
 */
export class AudioStreamPlayer {
  private audioContext: AudioContext | null = null;
  private queue: AudioBuffer[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private nextStartTime = 0;
  private onEndedCallback: (() => void) | null = null;
  private pendingChunks = 0;
  private flushed = false;
  private scheduledCount = 0;
  private finishedCount = 0;

  /** Must be called from a user gesture context to unlock AudioContext */
  init(): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }

  /** Accept a base64-encoded audio chunk (mp3), decode and queue for playback */
  async addChunk(base64Audio: string): Promise<void> {
    if (!this.audioContext) {
      throw new Error("AudioStreamPlayer: call init() before addChunk()");
    }

    this.pendingChunks++;

    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;

    // Decode the audio data
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
    } catch (err) {
      this.pendingChunks--;
      console.error("AudioStreamPlayer: failed to decode audio chunk", err);
      this.checkEnded();
      return;
    }

    this.pendingChunks--;
    this.queue.push(audioBuffer);

    // Start playback if not already playing
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.nextStartTime = this.audioContext.currentTime;
      this.drainQueue();
    }
  }

  /** Signal that no more chunks will arrive — fire onEnded when queue drains */
  flush(): void {
    this.flushed = true;
    this.checkEnded();
  }

  /** Stop all playback immediately */
  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // Already stopped
      }
      this.currentSource = null;
    }

    this.queue = [];
    this.isPlaying = false;
    this.nextStartTime = 0;
    this.pendingChunks = 0;
    this.flushed = false;
    this.scheduledCount = 0;
    this.finishedCount = 0;
  }

  /** Register callback for when all queued audio has finished playing */
  set onEnded(callback: (() => void) | null) {
    this.onEndedCallback = callback;
  }

  /** Drain the queue, scheduling each buffer for gapless playback */
  private drainQueue(): void {
    while (this.queue.length > 0) {
      this.scheduleNext();
    }
  }

  /** Schedule the next buffer in the queue for gapless playback */
  private scheduleNext(): void {
    if (!this.audioContext || this.queue.length === 0) {
      return;
    }

    const buffer = this.queue.shift()!;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    // Ensure we never schedule in the past
    const now = this.audioContext.currentTime;
    if (this.nextStartTime < now) {
      this.nextStartTime = now;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
    this.scheduledCount++;

    // Track the most recently scheduled source so stop() can cancel it
    this.currentSource = source;

    source.onended = () => {
      this.finishedCount++;
      this.checkEnded();
    };
  }

  /** Check whether all audio has finished and fire the onEnded callback */
  private checkEnded(): void {
    if (
      this.flushed &&
      this.queue.length === 0 &&
      this.pendingChunks === 0 &&
      this.finishedCount >= this.scheduledCount
    ) {
      this.isPlaying = false;
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    }
  }

  /** Clean up all resources */
  destroy(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.onEndedCallback = null;
  }
}
