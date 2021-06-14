import mongoose from 'mongoose';
import pkg from 'mongoose';
const { Schema } = pkg;
const AppointmentSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String },
    time: { weekNumber: Number, year: Number, cellId: Number }
  },
  {
    timestamps: true
  }
);


export default mongoose.model('Appointment', AppointmentSchema);

