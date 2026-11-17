import mongoose from 'mongoose';

const experimentSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      default: '',
    },
    baselineRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestRun',
      default: null,
    },
    protectedRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestRun',
      default: null,
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
      default: 'queued',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.projectId = ret.projectId.toString();
        ret.ownerId = ret.ownerId.toString();
        if (ret.baselineRunId) {
          ret.baselineRunId = ret.baselineRunId.toString();
        }
        if (ret.protectedRunId) {
          ret.protectedRunId = ret.protectedRunId.toString();
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.projectId = ret.projectId.toString();
        ret.ownerId = ret.ownerId.toString();
        if (ret.baselineRunId) {
          ret.baselineRunId = ret.baselineRunId.toString();
        }
        if (ret.protectedRunId) {
          ret.protectedRunId = ret.protectedRunId.toString();
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

experimentSchema.index({ projectId: 1, createdAt: -1 });
experimentSchema.index({ ownerId: 1, createdAt: -1 });

export const Experiment = mongoose.model('Experiment', experimentSchema);
