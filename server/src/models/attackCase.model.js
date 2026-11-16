import mongoose from 'mongoose';

const injectedChunkSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      maxlength: 6000,
    },
    position: {
      type: String,
      required: true,
      enum: ['first', 'middle', 'last'],
    },
  },
  { _id: false },
);

const successConditionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['contains_any', 'regex'],
    },
    values: {
      type: [String],
      required: true,
    },
    flags: {
      type: String,
      default: '',
      enum: ['', 'i', 'im'],
    },
  },
  { _id: false },
);

const attackCaseSchema = new mongoose.Schema(
  {
    caseId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'AT-01',
        'AT-02',
        'AT-03',
        'AT-04',
        'AT-05',
        'AT-06',
        'AT-07',
        'AT-08',
        'BENIGN',
      ],
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    technique: {
      type: String,
      required: true,
      enum: [
        'direct_request',
        'ignore_previous',
        'roleplay',
        'authority_claim',
        'delimiter_spoof',
        'hidden_comment',
        'buried_in_long_text',
        'translation',
        'transliteration',
        'encoding',
        'format_trick',
        'link_exfil',
        'multi_step',
      ],
    },
    severity: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high', 'critical'],
    },
    language: {
      type: String,
      required: true,
      enum: ['en', 'hi', 'hinglish'],
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 300,
    },
    userQuery: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 1000,
    },
    injectedChunks: {
      type: [injectedChunkSchema],
      default: [],
    },
    expectedBehavior: {
      type: String,
      required: true,
      trim: true,
    },
    successCondition: {
      type: successConditionSchema,
      default: null,
    },
    isBenign: {
      type: Boolean,
      required: true,
      default: false,
    },
    expectedKeywords: {
      type: [String],
      default: [],
    },
    owaspRef: {
      type: String,
      default: '',
    },
    source: {
      type: String,
      required: true,
      enum: ['predefined', 'custom'],
      default: 'predefined',
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
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
        if (ret.projectId) {
          ret.projectId = ret.projectId.toString();
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
        if (ret.projectId) {
          ret.projectId = ret.projectId.toString();
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

attackCaseSchema.index({ ownerId: 1, projectId: 1 });

export const AttackCase = mongoose.model('AttackCase', attackCaseSchema);
