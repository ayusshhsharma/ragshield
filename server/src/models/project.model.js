import mongoose from 'mongoose';
import { DEFAULT_DEFENSE_CONFIG, DEFAULT_RAG_CONFIG } from '../config/defaults.js';

const ragConfigSchema = new mongoose.Schema(
  {
    chunkSize: {
      type: Number,
      required: true,
      default: DEFAULT_RAG_CONFIG.chunkSize,
    },
    chunkOverlap: {
      type: Number,
      required: true,
      default: DEFAULT_RAG_CONFIG.chunkOverlap,
    },
    topK: {
      type: Number,
      required: true,
      default: DEFAULT_RAG_CONFIG.topK,
    },
    systemPrompt: {
      type: String,
      required: true,
      default: DEFAULT_RAG_CONFIG.systemPrompt,
    },
  },
  { _id: false },
);

const scannerConfigSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    threshold: {
      type: Number,
      required: true,
      default: 0.5,
    },
  },
  { _id: false },
);

const toggleConfigSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { _id: false },
);

const defenseConfigSchema = new mongoose.Schema(
  {
    inputScanner: {
      type: scannerConfigSchema,
      default: () => ({ ...DEFAULT_DEFENSE_CONFIG.inputScanner }),
    },
    documentScanner: {
      type: scannerConfigSchema,
      default: () => ({ ...DEFAULT_DEFENSE_CONFIG.documentScanner }),
    },
    instructionIsolation: {
      type: toggleConfigSchema,
      default: () => ({ ...DEFAULT_DEFENSE_CONFIG.instructionIsolation }),
    },
    outputValidator: {
      type: toggleConfigSchema,
      default: () => ({ ...DEFAULT_DEFENSE_CONFIG.outputValidator }),
    },
  },
  { _id: false },
);

const projectSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    ragConfig: {
      type: ragConfigSchema,
      default: () => ({ ...DEFAULT_RAG_CONFIG }),
    },
    defenseConfig: {
      type: defenseConfigSchema,
      default: () => ({
        inputScanner: { ...DEFAULT_DEFENSE_CONFIG.inputScanner },
        documentScanner: { ...DEFAULT_DEFENSE_CONFIG.documentScanner },
        instructionIsolation: { ...DEFAULT_DEFENSE_CONFIG.instructionIsolation },
        outputValidator: { ...DEFAULT_DEFENSE_CONFIG.outputValidator },
      }),
    },
    demoKbLoaded: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        if (ret.ownerId) {
          ret.ownerId = ret.ownerId.toString();
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        if (ret.ownerId) {
          ret.ownerId = ret.ownerId.toString();
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

projectSchema.index({ ownerId: 1, createdAt: -1 });

export const Project = mongoose.model('Project', projectSchema);
