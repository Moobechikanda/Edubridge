GRANT EXECUTE ON FUNCTION public.is_linked_parent(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_student(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_teacher(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assignment_teacher(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_parent_of_class_student(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;