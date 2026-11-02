import { useState } from 'react'
import Header from '../components/Header'
import CourseBuilder, { CourseForm } from '../components/CourseBuilder'

export default function Courses() {
  const [courseEditor, setCourseEditor] = useState(null)

  if (courseEditor) {
    return (
      <CourseForm
        key={courseEditor}
        courseId={courseEditor === 'new' ? null : courseEditor}
        onClose={() => setCourseEditor(null)}
      />
    )
  }

  return (
    <>
      <Header title="Courses" subtitle="Add and edit scorecards" />
      <div className="flex flex-1 flex-col px-4 py-6">
        <CourseBuilder onCreate={() => setCourseEditor('new')} onEdit={setCourseEditor} />
      </div>
    </>
  )
}
